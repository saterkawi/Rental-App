import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, Linking, StatusBar, SafeAreaView,
  StyleSheet, Platform, AppState
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const STORAGE_KEY = 'rental_tenants_v2';

const SAMPLE_TENANTS = [
  {
    id: 1,
    name: 'احمد محمد الغامدي',
    unit: 'شقة 101',
    phone: '966501234567',
    rent: 3500,
    startDate: '2024-01-01',
    endDate: '2026-06-01',
    payments: [
      { month: 'يناير 2026', amount: 3500, paid: true, date: '2026-01-03' },
      { month: 'فبراير 2026', amount: 3500, paid: true, date: '2026-02-05' },
      { month: 'مارس 2026', amount: 3500, paid: true, date: '2026-03-02' },
      { month: 'ابريل 2026', amount: 3500, paid: false, date: null },
    ],
  },
  {
    id: 2,
    name: 'فاطمة علي الزهراني',
    unit: 'شقة 203',
    phone: '966509876543',
    rent: 4200,
    startDate: '2023-06-01',
    endDate: '2026-06-01',
    payments: [
      { month: 'يناير 2026', amount: 4200, paid: true, date: '2026-01-01' },
      { month: 'فبراير 2026', amount: 4200, paid: true, date: '2026-02-01' },
      { month: 'مارس 2026', amount: 4200, paid: false, date: null },
      { month: 'ابريل 2026', amount: 4200, paid: false, date: null },
    ],
  },
];

function getDaysUntilExpiry(endDate) {
  var end = new Date(endDate);
  var today = new Date();
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount) {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ر.س';
}

async function requestNotificationPermission() {
  try {
    var result = await Notifications.requestPermissionsAsync();
    return result.status === 'granted';
  } catch (e) {
    return false;
  }
}

async function scheduleReminder(tenant, type) {
  try {
    var title = '';
    var body = '';
    if (type === 'overdue') {
      var overdue = tenant.payments.filter(function(p) { return !p.paid; });
      var amt = overdue.reduce(function(s, p) { return s + p.amount; }, 0);
      title = 'تذكير متاخرات - ' + tenant.name;
      body = 'يوجد ' + overdue.length + ' دفعة متاخرة بقيمة ' + formatCurrency(amt);
    } else if (type === 'expiry') {
      var days = getDaysUntilExpiry(tenant.endDate);
      title = 'عقد ينتهي قريبا - ' + tenant.name;
      body = 'عقد ' + tenant.unit + ' ينتهي خلال ' + days + ' يوم';
    } else {
      title = 'تذكير ايجار - ' + tenant.name;
      body = 'موعد سداد ايجار ' + tenant.unit + ' - ' + formatCurrency(tenant.rent);
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: title, body: body, sound: true },
      trigger: { seconds: 2 },
    });
  } catch (e) {
    console.log('notification error', e);
  }
}

export default function App() {
  var s1 = useState('dashboard');
  var activeTab = s1[0]; var setActiveTab = s1[1];

  var s2 = useState([]);
  var tenants = s2[0]; var setTenants = s2[1];

  var s3 = useState(true);
  var loading = s3[0]; var setLoading = s3[1];

  var s4 = useState(false);
  var showAddModal = s4[0]; var setShowAddModal = s4[1];

  var s5 = useState({ name: '', unit: '', phone: '', rent: '', startDate: '', endDate: '' });
  var newTenant = s5[0]; var setNewTenant = s5[1];

  var s6 = useState(false);
  var notifEnabled = s6[0]; var setNotifEnabled = s6[1];

  // Load data on start
  useEffect(function() {
    requestNotificationPermission().then(function(granted) {
      setNotifEnabled(granted);
    });
    AsyncStorage.getItem(STORAGE_KEY).then(function(data) {
      if (data) {
        try {
          var parsed = JSON.parse(data);
          if (parsed && parsed.length > 0) {
            setTenants(parsed);
          } else {
            setTenants(SAMPLE_TENANTS);
          }
        } catch (e) {
          setTenants(SAMPLE_TENANTS);
        }
      } else {
        setTenants(SAMPLE_TENANTS);
      }
      setLoading(false);
    }).catch(function() {
      setTenants(SAMPLE_TENANTS);
      setLoading(false);
    });
  }, []);

  // Save whenever tenants change
  useEffect(function() {
    if (!loading && tenants.length >= 0) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tenants)).catch(function(e) {
        console.log('save error', e);
      });
    }
  }, [tenants, loading]);

  var totalCollected = 0;
  for (var i = 0; i < tenants.length; i++) {
    for (var j = 0; j < tenants[i].payments.length; j++) {
      if (tenants[i].payments[j].paid) totalCollected += tenants[i].payments[j].amount;
    }
  }

  var totalOverdue = 0;
  for (var i = 0; i < tenants.length; i++) {
    for (var j = 0; j < tenants[i].payments.length; j++) {
      if (!tenants[i].payments[j].paid) totalOverdue += tenants[i].payments[j].amount;
    }
  }

  var expiringContracts = [];
  for (var i = 0; i < tenants.length; i++) {
    var d = getDaysUntilExpiry(tenants[i].endDate);
    if (d >= 0 && d <= 60) expiringContracts.push(tenants[i]);
  }

  function sendWhatsApp(tenant, type) {
    var overdue = [];
    for (var i = 0; i < tenant.payments.length; i++) {
      if (!tenant.payments[i].paid) overdue.push(tenant.payments[i]);
    }
    var overdueAmount = 0;
    for (var i = 0; i < overdue.length; i++) overdueAmount += overdue[i].amount;

    var msg = '';
    if (type === 'overdue') {
      msg = 'السلام عليكم ' + tenant.name + ',\nنود تذكيركم بوجود مبالغ مستحقة بقيمة ' + formatCurrency(overdueAmount) + '.\nيرجى التكرم بالسداد في اقرب وقت.\nشكرا لتعاونكم';
    } else if (type === 'expiry') {
      var days = getDaysUntilExpiry(tenant.endDate);
      msg = 'السلام عليكم ' + tenant.name + ',\nعقد ايجار ' + tenant.unit + ' سينتهي خلال ' + days + ' يوما.\nيرجى التواصل لتجديد العقد.\nشكرا';
    } else {
      msg = 'السلام عليكم ' + tenant.name + ',\nتذكير بموعد سداد ايجار ' + tenant.unit + ' البالغ ' + formatCurrency(tenant.rent) + '.\nشكرا لتعاونكم';
    }

    if (notifEnabled) { scheduleReminder(tenant, type); }

    var encoded = encodeURIComponent(msg);
    var waUrl = 'whatsapp://send?phone=' + tenant.phone + '&text=' + encoded;
    var webUrl = 'https://wa.me/' + tenant.phone + '?text=' + encoded;

    Linking.openURL(waUrl).catch(function() {
      Linking.openURL(webUrl).catch(function() {
        Alert.alert('تنبيه', 'تعذر فتح واتساب');
      });
    });
  }

  function addTenant() {
    if (!newTenant.name || !newTenant.unit || !newTenant.phone || !newTenant.rent) {
      Alert.alert('تنبيه', 'يرجى ملء الحقول المطلوبة');
      return;
    }
    var t = {
      id: Date.now(),
      name: newTenant.name,
      unit: newTenant.unit,
      phone: newTenant.phone,
      rent: parseInt(newTenant.rent) || 0,
      startDate: newTenant.startDate,
      endDate: newTenant.endDate,
      payments: [],
    };
    var updated = tenants.concat([t]);
    setTenants(updated);
    setNewTenant({ name: '', unit: '', phone: '', rent: '', startDate: '', endDate: '' });
    setShowAddModal(false);
    Alert.alert('تم', 'تم اضافة المستاجر وحفظه بنجاح');
  }

  function markPaid(tenantId, monthIndex) {
    var updated = tenants.map(function(t) {
      if (t.id !== tenantId) return t;
      var payments = t.payments.slice();
      payments[monthIndex] = {
        month: payments[monthIndex].month,
        amount: payments[monthIndex].amount,
        paid: true,
        date: new Date().toISOString().split('T')[0],
      };
      return { id: t.id, name: t.name, unit: t.unit, phone: t.phone, rent: t.rent, startDate: t.startDate, endDate: t.endDate, payments: payments };
    });
    setTenants(updated);
    Alert.alert('تم', 'تم تسجيل الدفع وحفظه');
  }

  function deleteTenant(id) {
    Alert.alert('حذف', 'هل انت متاكد من الحذف؟', [
      { text: 'الغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: function() {
        var updated = tenants.filter(function(t) { return t.id !== id; });
        setTenants(updated);
      }},
    ]);
  }

  function sendAutoReminders() {
    var count = 0;
    for (var i = 0; i < tenants.length; i++) {
      var t = tenants[i];
      var hasOverdue = false;
      for (var j = 0; j < t.payments.length; j++) {
        if (!t.payments[j].paid) { hasOverdue = true; break; }
      }
      if (hasOverdue) {
        sendWhatsApp(t, 'overdue');
        count++;
      }
    }
    if (count === 0) Alert.alert('لا يوجد', 'لا يوجد متاخرون حاليا');
    else Alert.alert('تم', 'تم ارسال التذكيرات لـ ' + count + ' مستاجر');
  }

  var TABS = [
    { id: 'dashboard', label: 'الرئيسية', icon: '🏠' },
    { id: 'tenants', label: 'المستاجرون', icon: '👤' },
    { id: 'payments', label: 'المدفوعات', icon: '💰' },
    { id: 'reminders', label: 'التذكيرات', icon: '🔔' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#c9a84c', fontSize: 18 }}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f14" />

      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>🏢 ادارة الايجارات</Text>
          <Text style={styles.subtitle}>نظام متابعة المستاجرين</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={function() { setShowAddModal(true); }}>
          <Text style={styles.addBtnText}>+ اضافة</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {activeTab === 'dashboard' && (
          <View style={styles.screen}>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { borderTopColor: '#c9a84c' }]}>
                <Text style={styles.statLabel}>المستاجرون</Text>
                <Text style={[styles.statValue, { color: '#c9a84c' }]}>{tenants.length}</Text>
                <Text style={styles.statSuffix}>وحدة</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#4ade80' }]}>
                <Text style={styles.statLabel}>المحصل</Text>
                <Text style={[styles.statValue, { color: '#4ade80' }]}>{Math.floor(totalCollected / 1000) + 'k'}</Text>
                <Text style={styles.statSuffix}>ريال</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#f87171' }]}>
                <Text style={styles.statLabel}>المتاخرات</Text>
                <Text style={[styles.statValue, { color: '#f87171' }]}>{Math.floor(totalOverdue / 1000) + 'k'}</Text>
                <Text style={styles.statSuffix}>ريال</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#fb923c' }]}>
                <Text style={styles.statLabel}>عقود تنتهي</Text>
                <Text style={[styles.statValue, { color: '#fb923c' }]}>{expiringContracts.length}</Text>
                <Text style={styles.statSuffix}>خلال 60 يوم</Text>
              </View>
            </View>

            {notifEnabled && (
              <View style={styles.notifBanner}>
                <Text style={{ color: '#4ade80', fontSize: 12 }}>✅ الاشعارات التلقائية مفعلة</Text>
              </View>
            )}

            {expiringContracts.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>عقود تنتهي قريبا</Text>
                {expiringContracts.map(function(t) {
                  return (
                    <View key={String(t.id)} style={[styles.card, { borderTopColor: '#fb923c', borderTopWidth: 3 }]}>
                      <View style={styles.cardRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardName}>{t.name}</Text>
                          <Text style={styles.cardUnit}>{t.unit}</Text>
                          <Text style={{ fontSize: 11, color: '#fb923c', marginTop: 4 }}>{'ينتهي خلال ' + getDaysUntilExpiry(t.endDate) + ' يوم'}</Text>
                        </View>
                        <TouchableOpacity style={styles.waBtn} onPress={function() { sendWhatsApp(t, 'expiry'); }}>
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>تذكير</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.sectionTitle}>ملخص الوحدات</Text>
            {tenants.map(function(t) {
              var paid = 0;
              for (var i = 0; i < t.payments.length; i++) { if (t.payments[i].paid) paid++; }
              var total = t.payments.length;
              var pct = total ? paid / total : 0;
              var overdueCount = total - paid;
              var barColor = pct === 1 ? '#4ade80' : pct > 0.5 ? '#c9a84c' : '#f87171';
              return (
                <View key={String(t.id)} style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{t.name}</Text>
                      <Text style={styles.cardUnit}>{t.unit + ' - ' + formatCurrency(t.rent) + '/شهر'}</Text>
                    </View>
                    <View style={[styles.badge, overdueCount > 0 ? { backgroundColor: '#f8717122', borderColor: '#f87171' } : { backgroundColor: '#4ade8022', borderColor: '#4ade80' }]}>
                      <Text style={{ color: overdueCount > 0 ? '#f87171' : '#4ade80', fontSize: 11, fontWeight: '700' }}>
                        {overdueCount > 0 ? (overdueCount + ' متاخر') : 'محدث'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: (pct * 100) + '%', backgroundColor: barColor }]} />
                  </View>
                  <Text style={styles.progressLabel}>{paid + '/' + total + ' دفعة مسددة'}</Text>
                </View>
              );
            })}
          </View>
        )}

        {activeTab === 'tenants' && (
          <View style={styles.screen}>
            <Text style={styles.sectionTitle}>{'المستاجرون (' + tenants.length + ')'}</Text>
            {tenants.length === 0 && (
              <Text style={{ color: '#667788', textAlign: 'center', marginTop: 40, fontSize: 14 }}>لا يوجد مستاجرون. اضغط + اضافة</Text>
            )}
            {tenants.map(function(t) {
              var daysLeft = getDaysUntilExpiry(t.endDate);
              var overdueAmt = 0;
              for (var i = 0; i < t.payments.length; i++) {
                if (!t.payments[i].paid) overdueAmt += t.payments[i].amount;
              }
              return (
                <View key={String(t.id)} style={styles.card}>
                  <Text style={styles.cardName}>{t.name}</Text>
                  <Text style={{ fontSize: 12, color: '#c9a84c', marginBottom: 4 }}>{t.unit}</Text>
                  <Text style={{ fontSize: 12, color: '#8899bb', marginBottom: 4 }}>{formatCurrency(t.rent) + '/شهر'}</Text>
                  {overdueAmt > 0 && (<Text style={{ fontSize: 12, color: '#f87171', marginBottom: 4 }}>{'متاخر: ' + formatCurrency(overdueAmt)}</Text>)}
                  {daysLeft >= 0 && daysLeft <= 60 && (<Text style={{ fontSize: 12, color: '#fb923c', marginBottom: 4 }}>{'العقد ينتهي خلال ' + daysLeft + ' يوم'}</Text>)}
                  <Text style={{ fontSize: 11, color: '#667788', marginBottom: 12 }}>{'📞 ' + t.phone}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <TouchableOpacity style={styles.waBtn} onPress={function() { sendWhatsApp(t, 'rent'); }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>تذكير ايجار</Text>
                    </TouchableOpacity>
                    {overdueAmt > 0 && (
                      <TouchableOpacity style={styles.waBtn} onPress={function() { sendWhatsApp(t, 'overdue'); }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>اشعار تاخر</Text>
                      </TouchableOpacity>
                    )}
                    {daysLeft >= 0 && daysLeft <= 60 && (
                      <TouchableOpacity style={styles.waBtn} onPress={function() { sendWhatsApp(t, 'expiry'); }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>تجديد عقد</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.deleteBtn} onPress={function() { deleteTenant(t.id); }}>
                      <Text style={{ color: '#f87171', fontSize: 12 }}>حذف</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {activeTab === 'payments' && (
          <View style={styles.screen}>
            <Text style={styles.sectionTitle}>سجل المدفوعات</Text>
            {tenants.map(function(t) {
              return (
                <View key={String(t.id)} style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#c9a84c', marginBottom: 8 }}>{t.name + ' - ' + t.unit}</Text>
                  {t.payments.length === 0
                    ? <Text style={{ color: '#667788', fontSize: 12 }}>لا توجد دفعات مسجلة</Text>
                    : t.payments.map(function(p, i) {
                      return (
                        <View key={String(i)} style={[styles.payRow, p.paid ? { backgroundColor: '#4ade8011', borderColor: '#4ade8033' } : { backgroundColor: '#f8717111', borderColor: '#f8717133' }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#e8e0d4' }}>{p.month}</Text>
                            <Text style={{ fontSize: 11, color: p.paid ? '#4ade80' : '#f87171' }}>{p.paid ? ('تم الدفع ' + p.date) : 'لم يسدد'}</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: p.paid ? '#4ade80' : '#f87171', marginRight: 8 }}>{formatCurrency(p.amount)}</Text>
                          {!p.paid && (
                            <TouchableOpacity style={styles.payBtn} onPress={function() { markPaid(t.id, i); }}>
                              <Text style={{ color: '#4ade80', fontSize: 11, fontWeight: '700' }}>تسجيل دفع</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })
                  }
                </View>
              );
            })}
          </View>
        )}

        {activeTab === 'reminders' && (
          <View style={styles.screen}>
            <Text style={styles.sectionTitle}>🔔 التذكيرات التلقائية</Text>

            <View style={[styles.card, { borderTopColor: notifEnabled ? '#4ade80' : '#f87171', borderTopWidth: 3 }]}>
              <Text style={{ color: '#e8e0d4', fontSize: 14, fontWeight: '700', marginBottom: 8 }}>
                {notifEnabled ? '✅ الاشعارات مفعلة' : '❌ الاشعارات غير مفعلة'}
              </Text>
              <Text style={{ color: '#8899aa', fontSize: 12, marginBottom: 12 }}>
                {notifEnabled
                  ? 'ستصلك اشعارات تلقائية عند الضغط على ارسال تذكير'
                  : 'يرجى تفعيل الاشعارات من اعدادات الجهاز'}
              </Text>
              {!notifEnabled && (
                <TouchableOpacity style={styles.waBtn} onPress={function() {
                  requestNotificationPermission().then(function(g) {
                    setNotifEnabled(g);
                    if (!g) Alert.alert('تنبيه', 'يرجى تفعيل الاشعارات من اعدادات iPhone');
                  });
                }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>تفعيل الاشعارات</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionTitle}>ارسال تذكيرات واتساب</Text>
            <View style={styles.infoBox}>
              <Text style={{ color: '#aabbcc', fontSize: 13 }}>يفتح واتساب مع الرسالة جاهزة للارسال</Text>
            </View>

            <TouchableOpacity style={[styles.card, { backgroundColor: '#128C7E22', borderColor: '#25D36644' }]} onPress={sendAutoReminders}>
              <Text style={{ color: '#25D366', fontSize: 15, fontWeight: '800', textAlign: 'center' }}>
                📲 ارسال تذكيرات للمتاخرين تلقائياً
              </Text>
              <Text style={{ color: '#8899aa', fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                {'سيتم الارسال لـ ' + tenants.filter(function(t) { return t.payments.some(function(p) { return !p.paid; }); }).length + ' مستاجر متاخر'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>المتاخرون عن الدفع</Text>
            {tenants.filter(function(t) {
              for (var i = 0; i < t.payments.length; i++) { if (!t.payments[i].paid) return true; }
              return false;
            }).map(function(t) {
              var overdue = [];
              for (var i = 0; i < t.payments.length; i++) { if (!t.payments[i].paid) overdue.push(t.payments[i]); }
              var amt = 0;
              for (var i = 0; i < overdue.length; i++) amt += overdue[i].amount;
              return (
                <View key={String(t.id)} style={[styles.card, { borderTopColor: '#f87171', borderTopWidth: 3 }]}>
                  <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{t.name}</Text>
                      <Text style={styles.cardUnit}>{t.unit}</Text>
                      <Text style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>{overdue.length + ' دفعة متاخرة - ' + formatCurrency(amt)}</Text>
                    </View>
                    <TouchableOpacity style={styles.waBtn} onPress={function() { sendWhatsApp(t, 'overdue'); }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>ارسال</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            <Text style={styles.sectionTitle}>ارسال جماعي</Text>
            <View style={styles.card}>
              <View style={[styles.bulkRow, styles.bulkBorder]}>
                <Text style={{ fontSize: 13, color: '#ccddee', flex: 1 }}>تذكير ايجار شهري للجميع</Text>
                <TouchableOpacity style={styles.greenBtn} onPress={function() { if (tenants.length > 0) sendWhatsApp(tenants[0], 'rent'); }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>ارسال</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.bulkRow, styles.bulkBorder]}>
                <Text style={{ fontSize: 13, color: '#ccddee', flex: 1 }}>اشعار المتاخرين</Text>
                <TouchableOpacity style={styles.greenBtn} onPress={function() {
                  var filtered = tenants.filter(function(t) {
                    for (var i = 0; i < t.payments.length; i++) { if (!t.payments[i].paid) return true; }
                    return false;
                  });
                  if (filtered.length > 0) sendWhatsApp(filtered[0], 'overdue');
                  else Alert.alert('لا يوجد', 'لا يوجد متاخرون');
                }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>ارسال</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.bulkRow}>
                <Text style={{ fontSize: 13, color: '#ccddee', flex: 1 }}>تنبيه عقود تنتهي</Text>
                <TouchableOpacity style={styles.greenBtn} onPress={function() {
                  var filtered = tenants.filter(function(t) { var d = getDaysUntilExpiry(t.endDate); return d >= 0 && d <= 60; });
                  if (filtered.length > 0) sendWhatsApp(filtered[0], 'expiry');
                  else Alert.alert('لا يوجد', 'لا توجد عقود تنتهي قريبا');
                }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>ارسال</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      <View style={styles.tabBar}>
        {TABS.map(function(tab) {
          var isActive = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={styles.tabItem} onPress={function() { setActiveTab(tab.id); }}>
              {isActive && <View style={styles.tabIndicator} />}
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>اضافة مستاجر جديد</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>اسم المستاجر *</Text>
              <TextInput style={styles.fieldInput} placeholder="الاسم الكامل" placeholderTextColor="#445566" value={newTenant.name} onChangeText={function(v) { setNewTenant({ name: v, unit: newTenant.unit, phone: newTenant.phone, rent: newTenant.rent, startDate: newTenant.startDate, endDate: newTenant.endDate }); }} textAlign="right" />
              <Text style={styles.fieldLabel}>الوحدة *</Text>
              <TextInput style={styles.fieldInput} placeholder="شقة 101" placeholderTextColor="#445566" value={newTenant.unit} onChangeText={function(v) { setNewTenant({ name: newTenant.name, unit: v, phone: newTenant.phone, rent: newTenant.rent, startDate: newTenant.startDate, endDate: newTenant.endDate }); }} textAlign="right" />
              <Text style={styles.fieldLabel}>رقم الواتساب * (مثال: 966501234567)</Text>
              <TextInput style={styles.fieldInput} placeholder="966501234567" placeholderTextColor="#445566" value={newTenant.phone} onChangeText={function(v) { setNewTenant({ name: newTenant.name, unit: newTenant.unit, phone: v, rent: newTenant.rent, startDate: newTenant.startDate, endDate: newTenant.endDate }); }} keyboardType="phone-pad" textAlign="right" />
              <Text style={styles.fieldLabel}>الايجار الشهري ر.س *</Text>
              <TextInput style={styles.fieldInput} placeholder="3500" placeholderTextColor="#445566" value={newTenant.rent} onChangeText={function(v) { setNewTenant({ name: newTenant.name, unit: newTenant.unit, phone: newTenant.phone, rent: v, startDate: newTenant.startDate, endDate: newTenant.endDate }); }} keyboardType="numeric" textAlign="right" />
              <Text style={styles.fieldLabel}>تاريخ بداية العقد (2025-01-01)</Text>
              <TextInput style={styles.fieldInput} placeholder="2025-01-01" placeholderTextColor="#445566" value={newTenant.startDate} onChangeText={function(v) { setNewTenant({ name: newTenant.name, unit: newTenant.unit, phone: newTenant.phone, rent: newTenant.rent, startDate: v, endDate: newTenant.endDate }); }} textAlign="right" />
              <Text style={styles.fieldLabel}>تاريخ نهاية العقد (2026-01-01)</Text>
              <TextInput style={styles.fieldInput} placeholder="2026-01-01" placeholderTextColor="#445566" value={newTenant.endDate} onChangeText={function(v) { setNewTenant({ name: newTenant.name, unit: newTenant.unit, phone: newTenant.phone, rent: newTenant.rent, startDate: newTenant.startDate, endDate: v }); }} textAlign="right" />
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#c9a84c' }]} onPress={addTenant}>
                <Text style={{ color: '#0f0f14', fontWeight: '800', fontSize: 15 }}>اضافة وحفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { borderWidth: 1, borderColor: '#667788' }]} onPress={function() { setShowAddModal(false); }}>
                <Text style={{ color: '#8899aa', fontSize: 15 }}>الغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

var styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f14' },
  header: { backgroundColor: '#1a1a2e', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#c9a84c33' },
  logo: { fontSize: 18, fontWeight: '800', color: '#c9a84c' },
  subtitle: { fontSize: 11, color: '#8899aa', marginTop: 2 },
  addBtn: { backgroundColor: '#c9a84c', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnText: { color: '#0f0f14', fontWeight: '800', fontSize: 13 },
  content: { flex: 1 },
  screen: { padding: 16 },
  notifBanner: { backgroundColor: '#4ade8022', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#4ade8044', alignItems: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: '#13131a', borderTopWidth: 1, borderTopColor: '#c9a84c22', paddingBottom: 16 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 10, color: '#667788', marginTop: 3 },
  tabLabelActive: { color: '#c9a84c', fontWeight: '700' },
  tabIndicator: { position: 'absolute', top: 0, left: '15%', right: '15%', height: 2, backgroundColor: '#c9a84c', borderRadius: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#ffffff11', borderTopWidth: 3 },
  statLabel: { fontSize: 11, color: '#8899aa', marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statSuffix: { fontSize: 10, color: '#667788', marginTop: 3 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#c9a84c', marginBottom: 12, marginTop: 4, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#c9a84c33' },
  card: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#c9a84c22' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#e8e0d4', marginBottom: 4 },
  cardUnit: { fontSize: 12, color: '#c9a84c' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  progressBg: { backgroundColor: '#ffffff11', borderRadius: 10, height: 6, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 10 },
  progressLabel: { fontSize: 10, color: '#667788', marginTop: 4 },
  waBtn: { backgroundColor: '#128C7E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  deleteBtn: { backgroundColor: '#f8717122', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#f8717144' },
  payRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1 },
  payBtn: { backgroundColor: '#4ade8022', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#4ade8044' },
  infoBox: { backgroundColor: '#128C7E22', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#25D36644' },
  bulkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  bulkBorder: { borderBottomWidth: 1, borderBottomColor: '#ffffff11' },
  greenBtn: { backgroundColor: '#128C7E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#1a1a2e', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#c9a84c33', maxHeight: '85%' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#c9a84c', marginBottom: 16, textAlign: 'right' },
  fieldLabel: { fontSize: 12, color: '#8899aa', marginBottom: 4, textAlign: 'right' },
  fieldInput: { backgroundColor: '#0f0f14', borderWidth: 1, borderColor: '#c9a84c33', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: '#e8e0d4', fontSize: 14, marginBottom: 10 },
  modalBtn: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
});
