import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Platform, KeyboardAvoidingView } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Share } from "react-native";
import { Share2, Clock, MapPin, Utensils, AlertTriangle, Coffee, MessageCircle, Send } from "lucide-react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ---- Filtreler ----
const KOTU_KELIMELER = ['orospu','sik','amk','piç','göt','sikik','yarrak','ibne','kahpe','bok','sıç','oç','amına','oğlum','bok'];
const argaIcerir = (t: string) => KOTU_KELIMELER.some(k => t.toLowerCase().includes(k));
const linkIcerir = (t: string) => /https?:\/\/|www\./i.test(t);

type Comment = { id: string; text: string };

// ---- DeviceId ----
const getDeviceId = async (): Promise<string> => {
  let id = await AsyncStorage.getItem('deviceId');
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); await AsyncStorage.setItem('deviceId', id); }
  return id!;
};

// ---- Yorum Bölümü ----
function CommentSection({ mealType, dateStr }: { mealType: 'breakfast' | 'dinner'; dateStr: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const isBreakfast = mealType === 'breakfast';
  const accent = isBreakfast ? '#d97706' : '#4f46e5';
  const bgCls = isBreakfast ? 'bg-amber-50 border-amber-100' : 'bg-indigo-50 border-indigo-100';

  useEffect(() => { loadComments(); checkDone(); }, [dateStr]);

  const checkDone = async () => {
    const v = await AsyncStorage.getItem(`commented_${dateStr}_${mealType}`);
    setDone(!!v);
  };

  const loadComments = async () => {
    try {
      const q = query(collection(db, 'comments', `${dateStr}_${mealType}`, 'posts'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setComments(snap.docs.map(d => ({ id: d.id, text: d.data().text })));
    } catch (e) { console.log(e); }
  };

  const submit = async () => {
    const t = input.trim();
    if (!t) return;
    if (t.length < 5) { Alert.alert('Çok Kısa', 'En az 5 karakter girin.'); return; }
    if (t.length > 150) { Alert.alert('Çok Uzun', 'En fazla 150 karakter.'); return; }
    if (argaIcerir(t)) { Alert.alert('Uygunsuz İçerik', 'Argo veya küfür içermeyen bir yorum yazın.'); return; }
    if (linkIcerir(t)) { Alert.alert('Link Yasak', 'Yorum içinde link paylaşamazsınız.'); return; }

    const cached = await AsyncStorage.getItem(`commented_${dateStr}_${mealType}`);
    if (cached) { setDone(true); Alert.alert('Zaten Yorum Yaptınız', 'Bu öğün için bugün yorum yaptınız.'); return; }

    setSending(true);
    try {
      const deviceId = await getDeviceId();
      await addDoc(collection(db, 'comments', `${dateStr}_${mealType}`, 'posts'), {
        text: t, deviceId, createdAt: serverTimestamp(),
      });
      await AsyncStorage.setItem(`commented_${dateStr}_${mealType}`, 'true');
      setInput(''); setDone(true);
      await loadComments();
    } catch (e: any) { Alert.alert('Hata', e.message); }
    setSending(false);
  };

  return (
    <View className="mt-5 pt-4 border-t border-gray-100">
      {/* Başlık */}
      <View className="flex-row items-center mb-3">
        <MessageCircle size={15} color={accent} />
        <Text className="text-sm font-bold text-gray-600 ml-1">Yorumlar</Text>
        <View style={{ backgroundColor: accent + '22' }} className="ml-2 px-2 py-0.5 rounded-full">
          <Text style={{ color: accent }} className="text-xs font-bold">{comments.length}</Text>
        </View>
      </View>

      {/* Yorum listesi */}
      {comments.length === 0
        ? <Text className="text-gray-400 text-xs text-center py-2">Henüz yorum yok. İlk yorumu sen yap!</Text>
        : comments.map(c => (
          <View key={c.id} className={`${bgCls} border rounded-2xl px-4 py-3 mb-2`}>
            <Text className="text-gray-700 text-sm leading-5">{c.text}</Text>
          </View>
        ))
      }

      {/* Input alanı */}
      {Platform.OS !== 'web' ? (
        done ? (
          <View className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mt-2 flex-row items-center">
            <Text className="text-green-600 text-sm font-semibold">Yorumunuz gönderildi ✓</Text>
          </View>
        ) : (
          <View className="mt-3">
            {!focused ? (
              /* Kompakt pill — tıklayınca açılır */
              <TouchableOpacity
                onPress={() => setFocused(true)}
                style={{ borderColor: accent + '60', borderWidth: 1.5 }}
                className="flex-row items-center bg-gray-50 rounded-full px-4 h-10"
              >
                <MessageCircle size={14} color={accent} />
                <Text className="text-gray-400 text-sm ml-2 flex-1">Yorum yaz...</Text>
                <Text style={{ color: accent }} className="text-xs font-semibold">Anonim</Text>
              </TouchableOpacity>
            ) : (
              /* Genişlemiş kart */
              <View style={{ borderColor: accent, borderWidth: 2 }} className="bg-white rounded-2xl px-4 pt-3 pb-2">
                <TextInput
                  style={{ fontSize: 15, color: '#1f2937', minHeight: 44, textAlignVertical: 'top' }}
                  placeholder="Yorum yaz... (anonim)"
                  placeholderTextColor="#9ca3af"
                  value={input}
                  onChangeText={setInput}
                  maxLength={150}
                  multiline
                  scrollEnabled={false}
                  autoFocus
                  onBlur={() => { if (!input.trim()) setFocused(false); }}
                />
                <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  <Text className="text-xs text-gray-400">{input.length}/150</Text>
                  <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => { setFocused(false); setInput(''); }} className="px-3 py-2 mr-1">
                      <Text className="text-gray-400 text-sm">İptal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={submit}
                      disabled={sending || input.trim().length < 2}
                      style={{ backgroundColor: input.trim().length >= 2 ? accent : '#d1d5db' }}
                      className="flex-row items-center px-4 py-2 rounded-xl"
                    >
                      <Send size={13} color="white" />
                      <Text className="text-white font-bold text-sm ml-1">
                        {sending ? '...' : 'Gönder'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        )
      ) : (
        <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 mt-2 items-center">
          <Text className="text-gray-400 text-xs">Yorum yapmak için mobil uygulamayı kullanın</Text>
        </View>
      )}
    </View>
  );
}

// ---- Ana Ekran ----
export default function App() {
  const getTodayStr = () => {
    const d = new Date();
    if (d.getHours() >= 23) d.setDate(d.getDate() + 1);
    const offset = d.getTimezoneOffset() * 60000;
    return (new Date(d.getTime() - offset)).toISOString().slice(0, 10);
  };

  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeDateStr, setActiveDateStr] = useState(getTodayStr);
  const [todayMenu, setTodayMenu] = useState<{ breakfast: string[]; dinner: string[] }>({
    breakfast: ['Yükleniyor...'],
    dinner: ['Yükleniyor...'],
  });

  useEffect(() => {
    const dateStr = getTodayStr();
    setActiveDateStr(dateStr);
    const unsub = subscribeToMenu(dateStr);

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const nd = getTodayStr();
      setActiveDateStr(prev => {
        if (prev !== nd) {
          unsub();
          subscribeToMenu(nd);
          return nd;
        }
        return prev;
      });
    }, 60000);

    return () => { unsub(); clearInterval(timer); };
  }, []);

  const getPrev = (d: string) => { const x = new Date(d); x.setDate(x.getDate() - 1); return x.toISOString().slice(0, 10); };

  const subscribeToMenu = (dateStr: string) => {
    // Önce cache'den anında göster
    AsyncStorage.getItem(`menu_${dateStr}`).then(cached => {
      if (cached) setTodayMenu(JSON.parse(cached));
    });

    // onSnapshot: Firestore local cache'i ANINDA verir, sonra server'dan günceller
    const unsub = onSnapshot(doc(db, 'meals', dateStr), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const m = {
          breakfast: d.breakfast || ['Henüz kahvaltı yüklenmemiş'],
          dinner: d.dinner || ['Henüz akşam yemeği yüklenmemiş']
        };
        setTodayMenu(m);
        AsyncStorage.setItem(`menu_${dateStr}`, JSON.stringify(m));
        AsyncStorage.removeItem(`menu_${getPrev(dateStr)}`);
      } else {
        AsyncStorage.getItem(`menu_${dateStr}`).then(cached => {
          if (!cached) setTodayMenu({ breakfast: ['Bugün menü yüklenmemiş.'], dinner: ['Bugün menü yüklenmemiş.'] });
        });
      }
    });

    return unsub;
  };

  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const isBreakfastTime = hours >= 6 && (hours < 12 || (hours === 12 && minutes === 0));
  const isDinnerTime = hours >= 16 && hours < 23;
  const isDinnerWarning = hours === 22 && minutes >= 30;
  const warnings = ['Şansına küs ana yemek bitti kral.', 'Kaldın mı garnitüre usta, hızlı in.', 'Bulaşıkları yıkamak istemiyorsan koş.', 'Son çorbalara yetiştin, afiyet olsun.'];

  const handleShare = async (mealType: 'breakfast' | 'dinner') => {
    try {
      if (mealType === 'breakfast') {
        await Share.share({ message: `Ahmet Kabaklı KYK — Sabah Kahvaltısı ☕\n${activeDateStr}\n\n• ${todayMenu.breakfast.join('\n• ')}\n\nGünlük menüleri görüntülemek için sitemizi kullanın:\nhttps://ahmetkabakli.vercel.app/` });
      } else {
        await Share.share({ message: `Ahmet Kabaklı KYK — Akşam Yemeği 🍽️\n${activeDateStr}\n\n• ${todayMenu.dinner.join('\n• ')}\n\nGünlük menüleri görüntülemek için sitemizi kullanın:\nhttps://ahmetkabakli.vercel.app/` });
      }
    } catch (e: any) { Alert.alert(e.message); }
  };

  const bLabels = ['Ana Yemek', 'Hamur İşi / Yumurta / Kek', 'Krem / Kaşar / Peynir', 'Zeytin', 'Reçel / Tereyağı / Labne / Salata'];
  const dLabels = ['Çorbalar', 'Ana Yemek', 'Pilav / Makarna', 'Meze / Tatlı / İçecek', 'Meze / Tatlı / İçecek'];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-4 pt-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">

        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-bold text-gray-900 tracking-tight">Günün Menüsü</Text>
            <View className="flex-row items-center mt-2">
              <MapPin size={16} color="#6b7280" />
              <Text className="text-gray-500 ml-1 font-medium">Ahmet Kabaklı KYK</Text>
            </View>
            <Text className="text-xs text-gray-400 mt-1">{activeDateStr}</Text>
          </View>
        </View>

        {isDinnerWarning && (
          <View className="bg-orange-100 border border-orange-200 rounded-2xl p-4 mb-6 flex-row items-center">
            <View className="bg-orange-200 p-2 rounded-full mr-3"><AlertTriangle size={20} color="#ea580c" /></View>
            <View className="flex-1">
              <Text className="text-orange-800 font-bold text-lg">Son 30 Dakika!</Text>
              <Text className="text-orange-700 mt-1">{warnings[currentTime.getDate() % warnings.length]}</Text>
            </View>
          </View>
        )}

        {/* Kahvaltı */}
        <View className={`bg-white rounded-3xl p-6 mb-5 shadow-sm border ${isBreakfastTime ? 'border-2 border-indigo-400' : 'border-gray-100'}`}>
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-row items-center">
              <View className="bg-amber-100 p-2 rounded-xl mr-3"><Coffee size={20} color="#d97706" /></View>
              <Text className="text-xl font-bold text-gray-800">Sabah Kahvaltısı</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity onPress={() => handleShare('breakfast')} className="bg-amber-50 p-2 rounded-xl border border-amber-100">
                <Share2 size={16} color="#d97706" />
              </TouchableOpacity>
              <View className="flex-row items-center bg-gray-50 px-2 py-1 rounded-md">
                <Clock size={14} color="#6b7280" />
                <Text className="text-xs text-gray-500 font-medium ml-1">06:00 - 12:30</Text>
              </View>
            </View>
          </View>
          <View className="space-y-4">
            {todayMenu.breakfast.map((item, i) => (
              <View key={i} className="flex-row items-center">
                <View className="bg-amber-50 rounded-xl h-10 w-10 items-center justify-center border border-amber-100 mr-3">
                  <Text className="text-amber-600 font-bold text-lg">{i + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">{bLabels[i] || 'Diğer'}</Text>
                  <Text className="text-gray-800 text-base font-medium">{item}</Text>
                </View>
              </View>
            ))}
          </View>
          <CommentSection mealType="breakfast" dateStr={activeDateStr} />
        </View>

        {/* Akşam */}
        <View className={`bg-white rounded-3xl p-6 mb-8 shadow-sm border ${isDinnerTime ? 'border-2 border-indigo-400' : 'border-gray-100'}`}>
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-row items-center">
              <View className="bg-indigo-100 p-2 rounded-xl mr-3"><Utensils size={20} color="#4f46e5" /></View>
              <Text className="text-xl font-bold text-gray-800">Akşam Yemeği</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity onPress={() => handleShare('dinner')} className="bg-indigo-50 p-2 rounded-xl border border-indigo-100">
                <Share2 size={16} color="#4f46e5" />
              </TouchableOpacity>
              <View className="flex-row items-center bg-gray-50 px-2 py-1 rounded-md">
                <Clock size={14} color="#6b7280" />
                <Text className="text-xs text-gray-500 font-medium ml-1">16:00 - 23:00</Text>
              </View>
            </View>
          </View>
          <View className="space-y-4">
            {todayMenu.dinner.map((item, i) => (
              <View key={i} className="flex-row items-center">
                <View className="bg-indigo-50 rounded-xl h-10 w-10 items-center justify-center border border-indigo-100 mr-3">
                  <Text className="text-indigo-600 font-bold text-lg">{i + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">{dLabels[i] || 'Diğer'}</Text>
                  <Text className="text-gray-800 text-base font-medium">{item}</Text>
                </View>
              </View>
            ))}
          </View>
          <CommentSection mealType="dinner" dateStr={activeDateStr} />
        </View>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
