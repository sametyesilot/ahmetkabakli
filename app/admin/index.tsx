import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert, Platform } from "react-native";
import { useState, useEffect } from "react";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Upload, Lock, User, ShieldAlert, Plus, Trash2, Calendar, ChevronDown, Check, FileText, Camera, Coffee, UtensilsCrossed, BookOpen, ClipboardList, LogOut } from "lucide-react-native";
import * as ImagePicker from 'expo-image-picker';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, auth } from '../../firebaseConfig';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

// Sabit Kategoriler
const BREAKFAST_CATEGORIES = [
  { key: "b1", label: "Ana Yemek (Kahvaltı)" },
  { key: "b2", label: "Simit / Yumurta / Kek / Poğaça" },
  { key: "b3", label: "Krem / Kaşar / Beyaz Peynir" },
  { key: "b4", label: "Zeytin" },
  { key: "b5", label: "Reçel / Tereyağı / Labne / Pekmez / Salata / Çikolata" },
];

const DINNER_CATEGORIES = [
  { key: "d1", label: "Çorbalar" },
  { key: "d2", label: "Ana Yemek (Akşam)" },
  { key: "d3", label: "Pilav / Makarna" },
  { key: "d4", label: "Meze / Tatlı / İçecek" },
];

const ALL_CATEGORIES = [...BREAKFAST_CATEGORIES, ...DINNER_CATEGORIES];

// Arama Filtreli Dropdown
function CategoryDropdown({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string; onSelect: (v: string) => void; }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  return (
    <View className="mb-3">
      <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</Text>
      <TouchableOpacity onPress={() => { setOpen(!open); setSearch(""); }} className={`flex-row items-center justify-between px-4 h-12 rounded-xl border ${open ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}>
        <Text className={`text-base ${selected ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{selected || "— Seçiniz —"}</Text>
        <ChevronDown size={18} color={open ? "#4f46e5" : "#9ca3af"} />
      </TouchableOpacity>
      {open && (
        <View className="border border-gray-200 rounded-xl mt-1 bg-white shadow-sm overflow-hidden">
          <View className="px-3 py-2 border-b border-gray-100">
            <TextInput
              placeholder="Ara..."
              value={search}
              onChangeText={setSearch}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-800"
              autoFocus
            />
          </View>
          {filtered.length === 0 ? (
            <View className="p-4"><Text className="text-gray-400 text-sm text-center">Sonuç bulunamadı</Text></View>
          ) : filtered.map((op, i) => (
            <TouchableOpacity key={i} onPress={() => { onSelect(op); setOpen(false); setSearch(""); }} className={`flex-row items-center px-4 py-3 border-b border-gray-100 ${selected === op ? 'bg-indigo-50' : ''}`}>
              {selected === op && <Check size={16} color="#4f46e5" style={{ marginRight: 8 }} />}
              <Text className={`text-base ${selected === op ? 'text-indigo-700 font-semibold' : 'text-gray-700'}`}>{op}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// Takvim Bileşeni
const TR_DAYS = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];
const TR_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
function CalendarPicker({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); } else setViewMonth(m => m+1); };
  return (
    <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
      <View className="flex-row items-center justify-between px-4 py-3 bg-indigo-600">
        <TouchableOpacity onPress={prevMonth} className="p-2">
          <Text className="text-white font-bold text-lg">‹</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold text-base">{TR_MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} className="p-2">
          <Text className="text-white font-bold text-lg">›</Text>
        </TouchableOpacity>
      </View>
      <View className="flex-row bg-indigo-50">
        {TR_DAYS.map(d => <View key={d} style={{flex:1}} className="items-center py-2"><Text className="text-xs font-bold text-indigo-400">{d}</Text></View>)}
      </View>
      {Array.from({length: cells.length/7}, (_, row) => (
        <View key={row} className="flex-row">
          {cells.slice(row*7, row*7+7).map((day, col) => {
            if (!day) return <View key={col} style={{flex:1}} className="h-10" />;
            const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isSelected = dateStr === selected;
            const isToday = dateStr === todayStr;
            return (
              <TouchableOpacity key={col} style={{flex:1}} onPress={() => onSelect(dateStr)}
                className={`h-10 items-center justify-center rounded-full m-0.5 ${isSelected ? 'bg-indigo-600' : isToday ? 'bg-indigo-100' : ''}`}>
                <Text className={`text-sm font-semibold ${isSelected ? 'text-white' : isToday ? 'text-indigo-700' : 'text-gray-700'}`}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function AdminScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"library" | "assign" | "json">("library");
  const [isLoading, setIsLoading] = useState(false);

  // Firebase Auth durumunu dinle
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setIsLoggedIn(!!user);
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { Alert.alert("Eksik Bilgi", "E-posta ve şifre giriniz."); return; }
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: any) {
      const msg = e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password'
        ? 'E-posta veya şifre yanlış.'
        : e.code === 'auth/too-many-requests'
        ? 'Çok fazla hatalı deneme. Lütfen bekleyin.'
        : 'Giriş başarısız: ' + e.message;
      Alert.alert("Giriş Başarısız", msg);
    }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setEmail("");
    setPassword("");
  };
  
  // Ürün Kütüphanesi
  const [products, setProducts] = useState<{[key: string]: string[]}>({});
  const [activeLibCat, setActiveLibCat] = useState(ALL_CATEGORIES[0].key);
  const [newProductName, setNewProductName] = useState("");
  
  // Menü Atama
  const [assignDate, setAssignDate] = useState(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return (new Date(d.getTime() - offset)).toISOString().slice(0, 10);
  });
  const [assignSelections, setAssignSelections] = useState<{[key: string]: string}>({});
  const [showD4Second, setShowD4Second] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const handleDateSelect = async (date: string) => {
    setAssignDate(date);
    setAssignSelections({});
    setShowD4Second(false);
    setLoadingExisting(true);
    try {
      const snap = await getDoc(doc(db, 'meals', date));
      if (snap.exists()) {
        const data = snap.data();
        const sel: {[key: string]: string} = {};
        if (data.breakfast) {
          BREAKFAST_CATEGORIES.forEach((c, i) => { if (data.breakfast[i]) sel[c.key] = data.breakfast[i]; });
        }
        if (data.dinner) {
          DINNER_CATEGORIES.forEach((c, i) => { if (data.dinner[i]) sel[c.key] = data.dinner[i]; });
          if (data.dinner[4]) { sel['d4_2'] = data.dinner[4]; setShowD4Second(true); }
        }
        setAssignSelections(sel);
      }
    } catch(e) { console.log(e); }
    setLoadingExisting(false);
  };

  // JSON Upload
  const [jsonInput, setJsonInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [base64Img, setBase64Img] = useState<string | null>(null);
  const [mealType, setMealType] = useState<"breakfast" | "dinner" | null>(null);

  useEffect(() => {
    if (isLoggedIn) loadProducts();
  }, [isLoggedIn]);

  const loadProducts = async () => {
    try {
      const snap = await getDocs(collection(db, 'products'));
      const data: {[key: string]: string[]} = {};
      snap.forEach(d => { data[d.id] = d.data().items || []; });
      setProducts(data);
    } catch (e) { console.log(e); }
  };

  const handleAddProduct = async () => {
    if (!newProductName.trim()) return;
    const current = products[activeLibCat] || [];
    if (current.includes(newProductName.trim())) { Alert.alert("Zaten Var", "Bu ürün zaten listede mevcut."); return; }
    const updated = [...current, newProductName.trim()];
    setIsLoading(true);
    try {
      await setDoc(doc(db, 'products', activeLibCat), { items: updated });
      setProducts(p => ({ ...p, [activeLibCat]: updated }));
      setNewProductName("");
    } catch (e: any) { Alert.alert("Hata", e.message); }
    setIsLoading(false);
  };

  const handleDeleteProduct = async (catKey: string, item: string) => {
    const updated = (products[catKey] || []).filter(p => p !== item);
    try {
      await setDoc(doc(db, 'products', catKey), { items: updated });
      setProducts(p => ({ ...p, [catKey]: updated }));
    } catch (e: any) { Alert.alert("Hata", e.message); }
  };

  const handleAssignMenu = async () => {
    if (!assignDate) { Alert.alert("Tarih Giriniz"); return; }
    const breakfast: string[] = BREAKFAST_CATEGORIES.map(c => assignSelections[c.key] || "");
    // Akşam: d4'ü tek kalem olarak al, d4_2 varsa 5. eleman olarak ekle
    const dinner: string[] = DINNER_CATEGORIES.map(c => assignSelections[c.key] || "");
    if (showD4Second && assignSelections['d4_2']) {
      dinner.push(assignSelections['d4_2']);
    }
    const dataToSave: any = {};
    if (breakfast.some(v => v)) dataToSave.breakfast = breakfast;
    if (dinner.some(v => v)) dataToSave.dinner = dinner;
    if (Object.keys(dataToSave).length === 0) { Alert.alert("Seçim Yok", "En az bir ürün seçin."); return; }
    setIsLoading(true);
    try {
      await setDoc(doc(db, 'meals', assignDate), dataToSave, { merge: true });
      Alert.alert("Başarılı!", `${assignDate} tarihi için menü kaydedildi.`);
      setAssignSelections({});
      setShowD4Second(false);
    } catch (e: any) { Alert.alert("Hata", e.message); }
    setIsLoading(false);
  };

  const handleUploadJSON = async () => {
    if (!jsonInput.trim()) { Alert.alert("Boş bıraktınız."); return; }
    setIsLoading(true);
    try {
      const days = JSON.parse(jsonInput);
      let kayitSayisi = 0;
      for (const day of days) {
        if (day.date) {
          const dataToSave: any = {};
          if (day.breakfast?.length > 0) dataToSave.breakfast = day.breakfast;
          if (day.dinner?.length > 0) dataToSave.dinner = day.dinner;
          if (Object.keys(dataToSave).length > 0) {
            await setDoc(doc(db, 'meals', day.date), dataToSave, { merge: true });
            kayitSayisi++;
          }
        }
      }
      setIsLoading(false);
      Alert.alert("Başarılı!", `${kayitSayisi} günlük menü sisteme eklendi.`);
      setJsonInput("");
    } catch (e: any) {
      setIsLoading(false);
      Alert.alert("Format Hatası", "Geçerli JSON değil.\n\n" + e.message);
    }
  };

  const handleUploadAI = async () => {
    if (!selectedImage || !base64Img) return;
    if (!mealType) { Alert.alert("Seçin", "Kahvaltı mı, Akşam Yemeği mi?"); return; }
    setIsLoading(true);
    try {
      const turAdi = mealType === 'breakfast' ? 'Sabah Kahvaltısı' : 'Akşam Yemeği';
      const prompt = mealType === 'breakfast'
        ? `Fotoğraf ${turAdi} listesi. Her günü bu formatta ver. 5 kalem, sırasıyla: 1. Ana Yemek, 2. Simit/yumurta/kek/poğaça vb, 3. Peynirler (krem/kaşar/beyaz), 4. Zeytin, 5. Reçel/tereyağı/labne/pekmez/salata/çikolata. Tabloda yazılı olmayan şeyler uydurma. Format: [{"date":"2026-04-15","breakfast":["Değer1","Değer2","Değer3","Değer4","Değer5"]}]`
        : `Fotoğraf ${turAdi} listesi. Her günü bu formatta ver. 4 kalem, sırasıyla: 1. Çorba, 2. Ana Yemek, 3. Pilav/Makarna, 4. Meze/Tatlı/İçecek. Format: [{"date":"2026-04-15","dinner":["Değer1","Değer2","Değer3","Değer4"]}]`;
      const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent([prompt, { inlineData: { data: base64Img, mimeType: "image/jpeg" } }]);
      let jsonText = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      const days = JSON.parse(jsonText);
      for (const day of days) {
        if (day.date && (day.breakfast || day.dinner)) {
          const menuRef = doc(db, 'meals', day.date);
          await setDoc(menuRef, day.breakfast ? { breakfast: day.breakfast } : { dinner: day.dinner }, { merge: true });
        }
      }
      setIsLoading(false);
      Alert.alert("Başarılı!", `${turAdi} listesi sisteme kaydedildi.`);
      setSelectedImage(null); setBase64Img(null); setMealType(null);
    } catch (e: any) {
      setIsLoading(false);
      Alert.alert("Sistem Hatası / Yoğun", e.message);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.6, base64: true });
    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
      if (result.assets[0].base64) setBase64Img(result.assets[0].base64);
    }
  };

  if (Platform.OS !== 'web') {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-6">
        <View className="bg-white p-8 rounded-3xl w-full items-center shadow-sm border border-gray-100">
          <View className="bg-red-100 p-4 rounded-full mb-4"><ShieldAlert size={36} color="#dc2626" /></View>
          <Text className="text-xl font-bold text-gray-800 text-center mb-2">Erişim Sınırlandırıldı</Text>
          <Text className="text-gray-500 text-center leading-5">Admin paneline sadece masaüstü tarayıcıdan erişebilirsiniz.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-6">
        <View className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-sm border border-gray-100 items-center">
          <View className="bg-indigo-100 p-4 rounded-full mb-6"><Lock size={32} color="#4f46e5" /></View>
          <Text className="text-2xl font-bold text-gray-800 mb-2 tracking-tight">Yönetici Girişi</Text>
          <Text className="text-gray-400 text-sm mb-6">Sadece yetkili erişim</Text>

          <View className="w-full bg-gray-50 flex-row items-center px-4 rounded-xl border border-gray-200 mb-3 h-14">
            <User size={20} color="#9ca3af" />
            <TextInput
              className="flex-1 ml-3 text-base text-gray-800 h-full"
              placeholder="E-posta adresi"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View className="w-full bg-gray-50 flex-row items-center px-4 rounded-xl border border-gray-200 mb-6 h-14">
            <Lock size={20} color="#9ca3af" />
            <TextInput
              className="flex-1 ml-3 text-base text-gray-800 h-full"
              placeholder="Şifre"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loginLoading}
            className={`w-full h-14 rounded-xl items-center justify-center ${loginLoading ? 'bg-indigo-400' : 'bg-indigo-600'}`}
          >
            <Text className="text-white font-bold text-lg">{loginLoading ? "Giriş yapılıyor..." : "Giriş Yap"}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // === ANA YÖNETİM PANELİ ===
  const activeCatInfo = ALL_CATEGORIES.find(c => c.key === activeLibCat)!;
  const activeCatItems = products[activeLibCat] || [];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-6 pb-4 bg-white border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Admin Paneli</Text>
        <TouchableOpacity onPress={handleLogout} className="flex-row items-center bg-red-50 px-3 py-2 rounded-xl">
          <LogOut size={16} color="#dc2626" />
          <Text className="text-red-600 font-semibold text-sm ml-1">Çıkış</Text>
        </TouchableOpacity>
      </View>

      {/* Sekmeler */}
      <View className="flex-row bg-white border-b border-gray-100 px-4">
        {[
          { key: "library",  icon: <BookOpen size={16} />,    label: "Ürün Kütüphanesi" },
          { key: "assign",   icon: <ClipboardList size={16} />, label: "Menü Ata" },
          { key: "json",     icon: <FileText size={16} />,    label: "Toplu Yükle" },
        ].map(tab => (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key as any)} className={`flex-1 items-center py-3 border-b-2 ${activeTab === tab.key ? 'border-indigo-500' : 'border-transparent'}`}>
            <View className="flex-row items-center gap-1">
              <View style={{ opacity: activeTab === tab.key ? 1 : 0.4 }}>{tab.icon}</View>
              <Text className={`text-xs font-semibold ml-1 ${activeTab === tab.key ? 'text-indigo-600' : 'text-gray-400'}`}>{tab.label}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* SEKME 1: ÜRÜN KÜTÜPHANESİ */}
      {activeTab === "library" && (
        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
          <Text className="text-gray-500 mb-4">Her kategoriye ürün ekleyin. Menü atarken bu listelerden seçeceksiniz.</Text>

          {/* Kategori Seçici */}
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Kategori Seç</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
            {ALL_CATEGORIES.map(c => (
              <TouchableOpacity key={c.key} onPress={() => { setActiveLibCat(c.key); setNewProductName(""); }} className={`mr-2 px-4 py-2 rounded-full border ${activeLibCat === c.key ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-200'}`}>
                <Text className={`text-sm font-semibold ${activeLibCat === c.key ? 'text-white' : 'text-gray-600'}`}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Seçili Kategorinin Ürünleri */}
          <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6">
            <Text className="text-lg font-bold text-gray-800 mb-4">{activeCatInfo.label}</Text>
            
            {activeCatItems.length === 0 ? (
              <Text className="text-gray-400 text-center py-4">Bu kategoride henüz ürün yok.</Text>
            ) : (
              activeCatItems.map((item, i) => (
                <View key={i} className="flex-row items-center justify-between py-3 border-b border-gray-100">
                  <View className="flex-row items-center">
                    <View className="w-2 h-2 rounded-full bg-indigo-400 mr-3" />
                    <Text className="text-gray-700 text-base">{item}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteProduct(activeLibCat, item)} className="bg-red-50 p-2 rounded-lg">
                    <Trash2 size={16} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* Yeni Ürün Ekle */}
            <View className="flex-row items-center mt-4 space-x-2">
              <TextInput
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 h-12 text-base"
                placeholder="Yeni ürün adı..."
                value={newProductName}
                onChangeText={setNewProductName}
              />
              <TouchableOpacity onPress={handleAddProduct} disabled={isLoading || !newProductName.trim()} className="bg-indigo-600 h-12 w-12 rounded-xl items-center justify-center ml-2">
                <Plus size={22} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* SEKME 2: GÜNLÜK MENÜ ATAMA */}
      {activeTab === "assign" && (
        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
          <Text className="text-gray-500 mb-4">Bir tarih seçin ve her kategoriden o güne ait ürünü seçin.</Text>
          
          <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-4">
            {/* Takvim */}
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tarih Seç</Text>
            <CalendarPicker selected={assignDate} onSelect={handleDateSelect} />
            {loadingExisting && <Text className="text-indigo-500 text-xs text-center mb-3">Mevcut menü yükleniyor...</Text>}
            {assignDate && !loadingExisting && (
              <View className="bg-indigo-50 rounded-xl px-4 py-2 mb-4 flex-row items-center">
                <Text className="text-indigo-700 text-sm font-semibold">{assignDate} seçildi{Object.keys(assignSelections).length > 0 ? ' — mevcut menü yüklendi ✓' : ''}</Text>
              </View>
            )}

            {/* KAHVALTI */}
            <View className="flex-row items-center mb-3">
              <View className="bg-amber-100 p-1.5 rounded-lg mr-2"><Coffee size={16} color="#d97706" /></View>
              <Text className="text-base font-bold text-gray-700">Sabah Kahvaltısı</Text>
            </View>
            {BREAKFAST_CATEGORIES.map(cat => (
              <CategoryDropdown
                key={cat.key}
                label={cat.label}
                options={products[cat.key] || []}
                selected={assignSelections[cat.key] || ""}
                onSelect={v => setAssignSelections(p => ({ ...p, [cat.key]: v }))}
              />
            ))}

            <View className="h-px bg-gray-100 my-4" />

            {/* AKŞAM YEMEĞİ */}
            <View className="flex-row items-center mb-3">
              <View className="bg-indigo-100 p-1.5 rounded-lg mr-2"><UtensilsCrossed size={16} color="#4f46e5" /></View>
              <Text className="text-base font-bold text-gray-700">Akşam Yemeği</Text>
            </View>
            {DINNER_CATEGORIES.map(cat => (
              <View key={cat.key}>
                <CategoryDropdown
                  label={cat.label}
                  options={products[cat.key] || []}
                  selected={assignSelections[cat.key] || ""}
                  onSelect={v => setAssignSelections(p => ({ ...p, [cat.key]: v }))}
                />
                {/* d4 için isteğe bağlı 2. ürün */}
                {cat.key === 'd4' && (
                  <View className="mb-3">
                    {!showD4Second ? (
                      <TouchableOpacity onPress={() => setShowD4Second(true)} className="flex-row items-center">
                        <Plus size={14} color="#4f46e5" />
                        <Text className="text-indigo-500 text-xs font-semibold ml-1">2. Meze / Tatlı / İçecek ekle (opsiyonel)</Text>
                      </TouchableOpacity>
                    ) : (
                      <View>
                        <CategoryDropdown
                          label="Meze / Tatlı / İçecek (2. Ürün)"
                          options={products['d4'] || []}
                          selected={assignSelections['d4_2'] || ""}
                          onSelect={v => setAssignSelections(p => ({ ...p, d4_2: v }))}
                        />
                        <TouchableOpacity onPress={() => { setShowD4Second(false); setAssignSelections(p => { const n = {...p}; delete n['d4_2']; return n; }); }} className="flex-row items-center mb-2">
                          <Text className="text-red-400 text-xs font-semibold">— 2. ürünü kaldır</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity onPress={handleAssignMenu} disabled={isLoading} className={`h-14 rounded-2xl items-center justify-center flex-row mb-10 ${isLoading ? 'bg-indigo-400' : 'bg-indigo-600'}`}>
            <Calendar size={20} color="white" />
            <Text className="text-white font-bold text-lg ml-2">{isLoading ? "Kaydediliyor..." : "Menüyü Kaydet"}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* SEKME 3: TOPLU YÜKLEME (JSON / AI) */}
      {activeTab === "json" && (
        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
          {/* Manual JSON */}
          <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
            <Text className="text-xl font-bold text-gray-800 mb-3">Hızlı Metin (JSON)</Text>
            <Text className="text-gray-500 mb-3 leading-5">AI'ye menü fotoğrafını atıp şu komutu kullanın:</Text>
            <View className="bg-gray-50 p-3 rounded-xl border border-gray-200 mb-4">
              <Text className="text-gray-600 font-mono text-xs leading-4">
                "Tablodaki listeyi incele. Her günü saf JSON dizisi olarak ver:{"\n\n"}
                KAHVALTIYSA (Tam 5 Kalem):{"\n"}
                1. Ana Yemek, 2. Simit/yumurta/kek/poğaça vb, 3. Peynirler, 4. Zeytin, 5. Reçel/tereyağı/labne/pekmez/salata/çikolata.{"\n"}
                [{"{"} "date": "2026-04-15", "breakfast": ["D1","D2","D3","D4","D5"] {"}"}]{"\n\n"}
                AKŞAM YEMEĞİYSE (Tam 4 Kalem):{"\n"}
                1. Çorba, 2. Ana Yemek, 3. Pilav/Makarna, 4. Meze/tatlı/içecek.{"\n"}
                [{"{"} "date": "2026-04-15", "dinner": ["D1","D2","D3","D4"] {"}"}]"
              </Text>
            </View>
            <TextInput className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 h-32 mb-4 text-gray-800" placeholder="[ { &quot;date&quot;: ... } ]" multiline textAlignVertical="top" value={jsonInput} onChangeText={setJsonInput} />
            <TouchableOpacity onPress={handleUploadJSON} disabled={isLoading} className={`h-14 rounded-xl items-center flex-row justify-center ${isLoading ? 'bg-emerald-400' : 'bg-emerald-600'}`}>
              <Upload size={18} color="white" />
              <Text className="text-white font-bold text-base ml-2">Sisteme Aktar</Text>
            </TouchableOpacity>
          </View>

          {/* AI Kamera */}
          <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-10 opacity-80">
            <Text className="text-xl font-bold text-gray-800 mb-3">AI Kamera (Deneysel)</Text>
            {!selectedImage ? (
              <TouchableOpacity onPress={pickImage} className="h-32 border-2 border-dashed border-gray-300 rounded-2xl items-center justify-center bg-gray-50">
                <Camera size={32} color="#9ca3af" />
                <Text className="text-gray-500 font-medium mt-2">Fotoğraf Seç</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Image source={{ uri: selectedImage }} className="w-full h-40 rounded-xl mb-3" resizeMode="cover" />
                <View className="flex-row mb-4 space-x-2">
                  <TouchableOpacity onPress={() => setMealType('breakfast')} className={`flex-1 p-3 rounded-xl border flex-row items-center justify-center ${mealType === 'breakfast' ? 'bg-amber-100 border-amber-300' : 'bg-white border-gray-200'}`}>
                    <Coffee size={16} color={mealType === 'breakfast' ? '#d97706' : '#9ca3af'} />
                    <Text className={`font-medium ml-1 ${mealType === 'breakfast' ? 'text-amber-700' : 'text-gray-500'}`}>Kahvaltı</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setMealType('dinner')} className={`flex-1 p-3 rounded-xl border flex-row items-center justify-center ${mealType === 'dinner' ? 'bg-indigo-100 border-indigo-300' : 'bg-white border-gray-200'}`}>
                    <UtensilsCrossed size={16} color={mealType === 'dinner' ? '#4f46e5' : '#9ca3af'} />
                    <Text className={`font-medium ml-1 ${mealType === 'dinner' ? 'text-indigo-700' : 'text-gray-500'}`}>Akşam Y.</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row space-x-2">
                  <TouchableOpacity onPress={() => { setSelectedImage(null); setBase64Img(null); setMealType(null); }} className="flex-1 bg-gray-100 p-4 rounded-xl items-center">
                    <Text className="text-gray-700 font-medium">Değiştir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleUploadAI} disabled={isLoading} className={`flex-1 p-4 rounded-xl items-center flex-row justify-center ${isLoading ? 'bg-indigo-400' : 'bg-indigo-600'}`}>
                    <Upload size={16} color="white" />
                    <Text className="text-white font-bold ml-1">{isLoading ? "Okunuyor..." : "Yükle"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
