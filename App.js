import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, Linking, StatusBar, SafeAreaView,
  StyleSheet, I18nManager, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Force RTL
I18nManager.forceRTL(true);

// ─── Sample Data ───────────────────────────────────────────────────────────
const SAMPLE_TENANTS = [
  {
    id: 1,
    name: 'أحمد محمد الغامدي',
    unit: 'شقة 101',
    phone: '966501234567',
    rent: 3500,
    startDate: '2024-01-01',
    endDate: '2026-01-01',
    payments: [
      { month: 'يناير 2026', amount: 3500, paid: true, date: '2026-01-03' },
      { month: 'فبراير 2026', amount: 3500, paid: true, date: '2026-02-05' },
      { month: 'مارس 2026', amount: 3500, paid: true, date: '2026-03-02' },
      { month: 'أبريل 2026', amount: 3500, paid: false, date: null },
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
      { month: 'أبريل 2026', amount: 4200, paid: false, date: null },
    ],
  },
  {
    id: 3,
    name: 'خالد عبدالله الحربي',
    unit: 'فيلا B2',
    phone: '966557891234',
    rent: 8000,
    startDate: '2024-03-15',
    endDate: '2026-05-01',
    payments: [
      { month: 'يناير 2026', amount: 8000, paid: true, date: '2026-01-10' },
      { month: 'فبراير 2026', amount: 8000, paid: true, date: '2026-02-08' },
      { month: 'مارس 2026', amount: 8000, paid: true, date: '2026-03-07' },
      { month: 'أبريل 2026', amount: 8000, paid: true, date: '2026-04-02' },
    ],
  },
  {
    id: 4,
    name: 'نورة سعد العتيبي',
    unit: 'شقة 305',
    phone: '966512345678',
    rent: 2800,
    startDate: '2024-08-01',
    endDate: '2026-08-01',
    payments: [
      { month: 'يناير 2026', amount: 2800, paid: false, date: null },
      { month: 'فبراير 2026', amount: 2800, paid: false, date: null },
      { month: 'مارس 2026', amount: 2800, paid: false, date: null },
      { month: 'أبريل 2026', amount: 2800, paid: false, date: null },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function getDaysUntilExpiry(endDate) {
  const end = new Date(endDate);
  const today = new Date();
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount) {
  return amount.toLocaleString('ar-SA') + ' ر.س';
}

const STORAGE_KEY = '@rental_tenants';

// ─── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tenants, setTenants] = useState(SAMPLE_TENANTS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTenant, setNewTenant] = useState({
    name: '', unit: '', phone: '', rent: '', startDate: '', endDate: '',
  });

  // Load saved data
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) setTenants(JSON.parse(data));
    });
  }, []);

  // Save whenever tenants change
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tenants));
  }, [tenants]);

  const totalCollected = tenants.reduce((s, t) =>
    s + t.payments.filter(p => p.paid).reduce((a, p) => a + p.amount, 0), 0);
  const totalOverdue = tenants.reduce((s, t) =>
    s + t.payments.filter(p => !p.paid).reduce((a, p) => a + p.amount, 0), 0);
  const expiringContracts = tenants.filter(t => {
    const d = getDaysUntilExpiry(t.endDate);
    return d >= 0 && d <= 60;
  });

  function sendWhatsApp(tenant, type) {
    const overdue = tenant.payments.filter(p => !p.paid);
    const overdueAmount = overdue.reduce((s, p) => s + p.amount, 0);
    let msg = '';

    if (type === 'overdue') {
      msg = `السلام عليكم ${tenant.name}،\nنود تذكيركم بوجود مبالغ مستحقة بقيمة ${formatCurrency(overdueAmount)} عن ${overdue.map(p => p.month).join('، ')}.\nيرجى التكرم بالسداد في أقرب وقت.\nشكراً لتعاونكم 🏠`;
    } else if (type === 'expiry') {
      const days = getDaysUntilExpiry(tenant.endDate);
      msg = `السلام عليكم ${tenant.name}،\nنود إعلامكم بأن عقد إيجار ${tenant.unit} سينتهي خلال ${days} يوماً بتاريخ ${tenant.endDate}.\nيرجى التواصل معنا لتجديد العقد.\nشكراً 🏠`;
    } else {
      msg = `السلام عليكم ${tenant.name}،\nتذكير بموعد سداد إيجار ${tenant.unit} البالغ ${formatCurrency(tenant.rent)}.\nشكراً لتعاونكم 🏠`;
    }

    const url = `whatsapp://send?phone=${tenant.phone}&text=${encodeURIComponent(msg)}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('تنبيه', 'يرجى تثبيت واتساب على جهازك');
      }
    });
  }

  function addTenant() {
    if (!newTenant.name || !newTenant.unit || !newTenant.phone || !newTenant.rent) {
      Alert.alert('تنبيه', 'يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    const t = {
      id: Date.now(),
      ...newTenant,
      rent: parseInt(newTenant.rent) || 0,
      payments: [],
    };
    setTenants(prev => [...prev, t]);
    setNewTenant({ name: '', unit: '', phone: '', rent: '', startDate: '', endDate: '' });
    setShowAddModal(false);
  }

  function markPaid(tenantId, monthIndex) {
    setTenants(prev => prev.map(t => {
      if (t.id !== tenantId) return t;
      const payments = [...t.payments];
      payments[monthIndex] = {
        ...payments[monthIndex],
        paid: true,
        date: new Date().toISOString().split('T')[0],
      };
      return { ...t, payments };
    }));
  }

  function deleteTenant(id) {
    Alert.alert(
      'حذف المستأجر',
      'هل أنت متأكد من حذف هذا المستأجر؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: () => setTenants(prev => prev.filter(t => t.id !== id)) },
      ]
    );
  }

  const TABS = [
    { id: 'dashboard', label: 'الرئيسية', icon: '⊞' },
    { id: 'tenants', label: 'المستأجرون', icon: '👤' },
    { id: 'payments', label: 'المدفوعات', icon: '💰' },
    { id: 'reminders', label: 'التذكيرات', icon: '🔔' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f14" />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.logo}>🏢 إدارة الإيجارات</Text>
          <Text style={s.subtitle}>نظام متابعة المستأجرين</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAddModal(true)}>
          <Text style={s.addBtnText}>+ إضافة</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'dashboard' && (
          <DashboardScreen
            tenants={tenants}
            totalCollected={totalCollected}
            totalOverdue={totalOverdue}
            expiringContracts={expiringContracts}
            onSendWhatsApp={sendWhatsApp}
            onTabChange={setActiveTab}
          />
        )}
        {activeTab === 'tenants' && (
          <TenantsScreen
            tenants={tenants}
            onSendWhatsApp={sendWhatsApp}
            onDelete={deleteTenant}
          />
        )}
        {activeTab === 'payments' && (
          <PaymentsScreen tenants={tenants} onMarkPaid={markPaid} />
        )}
        {activeTab === 'reminders' && (
          <RemindersScreen tenants={tenants} onSendWhatsApp={sendWhatsApp} />
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={s.tabItem}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={s.tabIcon}>{tab.icon}</Text>
            <Text style={[s.tabLabel, activeTab === tab.id && s.tabLabelActive]}>
              {tab.label}
            </Text>
            {activeTab === tab.id && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Add Tenant Modal */}
      <AddTenantModal
        visible={showAddModal}
        newTenant={newTenant}
        onChange={setNewTenant}
        onAdd={addTenant}
        onClose={() => setShowAddModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
function DashboardScreen({ tenants, totalCollected, totalOverdue, expiringContracts, onSendWhatsApp }) {
  return (
    <View style={s.screen}>
      <View style={s.statsGrid}>
        <StatCard label="المستأجرون" value={tenants.length} suffix="وحدة" color="#c9a84c" />
        <StatCard label="المحصّل" value={(totalCollected / 1000).toFixed(0) + 'k'} suffix="ريال" color="#4ade80" />
        <StatCard label="المتأخرات" value={(totalOverdue / 1000).toFixed(0) + 'k'} suffix="ريال" color="#f87171" />
        <StatCard label="عقود تنتهي" value={expiringContracts.length} suffix="خلال 60 يوم" color="#fb923c" />
      </View>

      {expiringContracts.length > 0 && (
        <>
          <SectionTitle>⚠️ عقود تنتهي قريباً</SectionTitle>
          {expiringContracts.map(t => (
            <View key={t.id} style={[s.card, { borderTopColor: '#fb923c', borderTopWidth: 3 }]}>
              <View style={s.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName}>{t.name}</Text>
                  <Text style={s.cardUnit}>{t.unit}</Text>
                  <Text style={{ fontSize: 11, color: '#fb923c', marginTop: 4 }}>
                    ينتهي خلال {getDaysUntilExpiry(t.endDate)} يوم
                  </Text>
                </View>
                <WAButton onPress={() => onSendWhatsApp(t, 'expiry')} label="تذكير" />
              </View>
            </View>
          ))}
        </>
      )}

      <SectionTitle>📊 ملخص الوحدات</SectionTitle>
      {tenants.map(t => {
        const paid = t.payments.filter(p => p.paid).length;
        const total = t.payments.length;
        const pct = total ? paid / total : 0;
        const overdueCount = t.payments.filter(p => !p.paid).length;
        return (
          <View key={t.id} style={s.card}>
            <View style={s.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{t.name}</Text>
                <Text style={s.cardUnit}>{t.unit} — {formatCurrency(t.rent)}/شهر</Text>
              </View>
              <View style={[s.badge, { backgroundColor: overdueCount > 0 ? '#f8717122' : '#4ade8022', borderColor: overdueCount > 0 ? '#f87171' : '#4ade80' }]}>
                <Text style={{ color: overdueCount > 0 ? '#f87171' : '#4ade80', fontSize: 11, fontWeight: '700' }}>
                  {overdueCount > 0 ? `${overdueCount} متأخر` : '✓ محدّث'}
                </Text>
              </View>
            </View>
            <View style={s.progressBg}>
              <View style={[s.progressFill, {
                width: `${pct * 100}%`,
                backgroundColor: pct === 1 ? '#4ade80' : pct > 0.5 ? '#c9a84c' : '#f87171'
              }]} />
            </View>
            <Text style={s.progressLabel}>{paid}/{total} دفعة مسددة</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Tenants ───────────────────────────────────────────────────────────────
function TenantsScreen({ tenants, onSendWhatsApp, onDelete }) {
  return (
    <View style={s.screen}>
      <SectionTitle>👤 قائمة المستأجرين ({tenants.length})</SectionTitle>
      {tenants.map(t => {
        const daysLeft = getDaysUntilExpiry(t.endDate);
        const overdueAmt = t.payments.filter(p => !p.paid).reduce((sum, p) => sum + p.amount, 0);
        return (
          <View key={t.id} style={s.card}>
            <Text style={s.cardName}>{t.name}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
              <BadgeChip color="#c9a84c">{t.unit}</BadgeChip>
              <BadgeChip color="#8899bb">{formatCurrency(t.rent)}</BadgeChip>
              {overdueAmt > 0 && <BadgeChip color="#f87171">متأخر {formatCurrency(overdueAmt)}</BadgeChip>}
              {daysLeft <= 60 && daysLeft >= 0 && <BadgeChip color="#fb923c">{daysLeft} يوم</BadgeChip>}
            </View>
            <Text style={{ fontSize: 12, color: '#667788', marginBottom: 12 }}>
              📞 {t.phone}{'  '}📅 {t.startDate} ← {t.endDate}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <WAButton onPress={() => onSendWhatsApp(t, 'rent')} label="📲 تذكير إيجار" />
              {overdueAmt > 0 && <WAButton onPress={() => onSendWhatsApp(t, 'overdue')} label="💬 إشعار تأخر" />}
              {daysLeft <= 60 && daysLeft >= 0 && <WAButton onPress={() => onSendWhatsApp(t, 'expiry')} label="🔔 تجديد عقد" />}
              <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(t.id)}>
                <Text style={{ color: '#f87171', fontSize: 12 }}>🗑 حذف</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Payments ──────────────────────────────────────────────────────────────
function PaymentsScreen({ tenants, onMarkPaid }) {
  return (
    <View style={s.screen}>
      <SectionTitle>💰 سجل المدفوعات</SectionTitle>
      {tenants.map(t => (
        <View key={t.id} style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#c9a84c', marginBottom: 8 }}>
            {t.name} — {t.unit}
          </Text>
          {t.payments.length === 0
            ? <Text style={{ color: '#667788', fontSize: 12 }}>لا توجد دفعات مسجّلة بعد</Text>
            : t.payments.map((p, i) => (
              <View key={i} style={[s.payRow, { backgroundColor: p.paid ? '#4ade8011' : '#f8717111', borderColor: p.paid ? '#4ade8033' : '#f8717133' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#e8e0d4' }}>{p.month}</Text>
                  <Text style={{ fontSize: 11, color: p.paid ? '#4ade80' : '#f87171' }}>
                    {p.paid ? `✓ تم الدفع ${p.date}` : '⏳ لم يُسدَّد'}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: p.paid ? '#4ade80' : '#f87171', marginRight: 8 }}>
                  {formatCurrency(p.amount)}
                </Text>
                {!p.paid && (
                  <TouchableOpacity style={s.payBtn} onPress={() => onMarkPaid(t.id, i)}>
                    <Text style={{ color: '#4ade80', fontSize: 11, fontWeight: '700' }}>تسجيل دفع</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          }
        </View>
      ))}
    </View>
  );
}

// ─── Reminders ─────────────────────────────────────────────────────────────
function RemindersScreen({ tenants, onSendWhatsApp }) {
  const overdueTenants = tenants.filter(t => t.payments.some(p => !p.paid));
  return (
    <View style={s.screen}>
      <SectionTitle>🔔 إرسال تذكيرات واتساب</SectionTitle>
      <View style={s.infoBox}>
        <Text style={{ color: '#aabbcc', fontSize: 13, lineHeight: 22 }}>
          📱 يتم فتح واتساب مع الرسالة جاهزة للإرسال لكل مستأجر
        </Text>
      </View>

      {overdueTenants.length > 0 && (
        <>
          <SectionTitle>⚠️ المتأخرون عن الدفع</SectionTitle>
          {overdueTenants.map(t => {
            const overdue = t.payments.filter(p => !p.paid);
            const amt = overdue.reduce((sum, p) => sum + p.amount, 0);
            return (
              <View key={t.id} style={[s.card, { borderTopColor: '#f87171', borderTopWidth: 3 }]}>
                <View style={s.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName}>{t.name}</Text>
                    <Text style={s.cardUnit}>{t.unit}</Text>
                    <Text style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>
                      {overdue.length} دفعة متأخرة — {formatCurrency(amt)}
                    </Text>
                  </View>
                  <WAButton onPress={() => onSendWhatsApp(t, 'overdue')} label="💬 إرسال" />
                </View>
              </View>
            );
          })}
        </>
      )}

      <SectionTitle>📅 إرسال جماعي</SectionTitle>
      <View style={s.card}>
        {[
          { label: 'تذكير إيجار شهري للجميع', icon: '📲', type: 'rent' },
          { label: 'إشعار المتأخرين عن السداد', icon: '⚠️', type: 'overdue' },
          { label: 'تنبيه عقود تنتهي قريباً', icon: '📋', type: 'expiry' },
        ].map((item, i) => (
          <View key={i} style={[s.bulkRow, i < 2 && s.bulkBorder]}>
            <Text style={{ fontSize: 13, color: '#ccd', flex: 1 }}>{item.icon} {item.label}</Text>
            <TouchableOpacity
              style={s.greenBtn}
              onPress={() => {
                const filtered = item.type === 'overdue'
                  ? tenants.filter(t => t.payments.some(p => !p.paid))
                  : item.type === 'expiry'
                    ? tenants.filter(t => { const d = getDaysUntilExpiry(t.endDate); return d >= 0 && d <= 60; })
                    : tenants;
                if (filtered.length > 0) {
                  filtered.forEach(t => onSendWhatsApp(t, item.type));
                } else {
                  Alert.alert('لا يوجد', 'لا يوجد مستأجرون في هذه الفئة');
                }
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>إرسال</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Add Tenant Modal ──────────────────────────────────────────────────────
function AddTenantModal({ visible, newTenant, onChange, onAdd, onClose }) {
  const fields = [
    { key: 'name', label: 'اسم المستأجر *', placeholder: 'الاسم الكامل', keyboardType: 'default' },
    { key: 'unit', label: 'الوحدة *', placeholder: 'شقة 101 / فيلا B2', keyboardType: 'default' },
    { key: 'phone', label: 'رقم الواتساب *', placeholder: '966501234567', keyboardType: 'phone-pad' },
    { key: 'rent', label: 'الإيجار الشهري (ر.س) *', placeholder: '3500', keyboardType: 'numeric' },
    { key: 'startDate', label: 'تاريخ بداية العقد', placeholder: '2025-01-01', keyboardType: 'default' },
    { key: 'endDate', label: 'تاريخ نهاية العقد', placeholder: '2026-01-01', keyboardType: 'default' },
  ];
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>➕ إضافة مستأجر جديد</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {fields.map(f => (
              <View key={f.key}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={s.fieldInput}
                  placeholder={f.placeholder}
                  placeholderTextColor="#445566"
                  value={newTenant[f.key]}
                  onChangeText={v => onChange({ ...newTenant, [f.key]: v })}
                  keyboardType={f.keyboardType}
                  textAlign="right"
                />
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={onAdd}>
              <Text style={{ color: '#0f0f14', fontWeight: '800', fontSize: 15 }}>✓ إضافة</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtn, s.modalBtnSecondary]} onPress={onClose}>
              <Text style={{ color: '#8899aa', fontSize: 15 }}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Small Components ──────────────────────────────────────────────────────
function StatCard({ label, value, suffix, color }) {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statSuffix}>{suffix}</Text>
    </View>
  );
}

function SectionTitle({ children }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

function WAButton({ onPress, label = 'إرسال' }) {
  return (
    <TouchableOpacity style={s.waBtn} onPress={onPress}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function BadgeChip({ children, color }) {
  return (
    <View style={[s.chip, { backgroundColor: color + '22', borderColor: color + '66' }]}>
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f14' },
  header: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#c9a84c33',
  },
  logo: { fontSize: 18, fontWeight: '800', color: '#c9a84c' },
  subtitle: { fontSize: 11, color: '#8899aa', marginTop: 2 },
  addBtn: {
    backgroundColor: '#c9a84c',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  addBtnText: { color: '#0f0f14', fontWeight: '800', fontSize: 13 },
  content: { flex: 1 },
  screen: { padding: 16 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#13131a',
    borderTopWidth: 1,
    borderTopColor: '#c9a84c22',
    paddingBottom: Platform.OS === 'ios' ? 16 : 4,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabIcon: { fontSize: 18 },
  tabLabel: { fontSize: 10, color: '#667788', marginTop: 3 },
  tabLabelActive: { color: '#c9a84c', fontWeight: '700' },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: '#c9a84c',
    borderRadius: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffffff11',
    borderTopWidth: 3,
  },
  statLabel: { fontSize: 11, color: '#8899aa', marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statSuffix: { fontSize: 10, color: '#667788', marginTop: 3 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c9a84c',
    marginBottom: 12,
    marginTop: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#c9a84c33',
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#c9a84c22',
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#e8e0d4', marginBottom: 4 },
  cardUnit: { fontSize: 12, color: '#c9a84c' },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  progressBg: {
    backgroundColor: '#ffffff11',
    borderRadius: 10,
    height: 6,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 10 },
  progressLabel: { fontSize: 10, color: '#667788', marginTop: 4 },
  waBtn: {
    backgroundColor: '#128C7E',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  deleteBtn: {
    backgroundColor: '#f8717122',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#f8717144',
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
  },
  payBtn: {
    backgroundColor: '#4ade8022',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#4ade8044',
  },
  infoBox: {
    backgroundColor: '#128C7E22',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#25D36644',
  },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  bulkBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff11',
  },
  greenBtn: {
    backgroundColor: '#128C7E',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#c9a84c33',
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#c9a84c',
    marginBottom: 16,
    textAlign: 'right',
  },
  fieldLabel: { fontSize: 12, color: '#8899aa', marginBottom: 4, textAlign: 'right' },
  fieldInput: {
    backgroundColor: '#0f0f14',
    borderWidth: 1,
    borderColor: '#c9a84c33',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#e8e0d4',
    fontSize: 14,
    marginBottom: 10,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  modalBtnPrimary: { backgroundColor: '#c9a84c' },
  modalBtnSecondary: { borderWidth: 1, borderColor: '#667788' },
});
