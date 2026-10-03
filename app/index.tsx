import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Platform, KeyboardAvoidingView } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Share } from "react-native";
import { Share2, Clock, MapPin, Utensils, AlertTriangle, Coffee, MessageCircle, Send, Star } from "lucide-react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, collection, addDoc, getDocs, getDoc, query, orderBy, serverTimestamp, runTransaction } from 'firebase/firestore';
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

// ---- Puanlama Bölümü ----
function RatingSection({ mealType, dateStr }: { mealType: 'breakfast' | 'dinner'; dateStr: string }) {
  const [ratingData, setRatingData] = useState<{ average: number; count: number; totalScore: number }>({
    average: 0,
    count: 0,
    totalScore: 0,
  });
  const [userScore, setUserScore] = useState<number | null>(null);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [benchmarkAverage, setBenchmarkAverage] = useState<number | null>(null);
  const [referenceDaysCount, setReferenceDaysCount] = useState<number>(0);
  const isBreakfast = mealType === 'breakfast';
  const ratingKey = `${dateStr}_${mealType}`;
  const accentColor = isBreakfast ? '#d97706' : '#4f46e5';

  useEffect(() => {
    checkUserVote();
    loadBenchmark();

    const ratingDocRef = doc(db, 'ratings', ratingKey);
    const unsub = onSnapshot(ratingDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRatingData({
          average: typeof data.average === 'number' ? data.average : 0,
          count: typeof data.count === 'number' ? data.count : 0,
          totalScore: typeof data.totalScore === 'number' ? data.totalScore : 0,
        });
      } else {
        setRatingData({ average: 0, count: 0, totalScore: 0 });
      }
    }, (err) => {
      console.log('Rating snapshot error:', err);
    });

    return () => unsub();
  }, [ratingKey]);

  const loadBenchmark = async () => {
    try {
      const snap = await getDocs(collection(db, 'ratings'));
      let sumAvg = 0;
      let countDays = 0;

      snap.forEach((docSnap) => {
        const id = docSnap.id;
        // Aynı öğün tipi olmalı (örn. breakfast veya dinner) ve geçerli gün olmamalı
        if (id.endsWith(`_${mealType}`) && !id.startsWith(`${dateStr}_`)) {
          const data = docSnap.data();
          if (data && typeof data.average === 'number' && data.count > 0) {
            sumAvg += data.average;
            countDays += 1;
          }
        }
      });

      if (countDays > 0) {
        setBenchmarkAverage(Math.round((sumAvg / countDays) * 10) / 10);
        setReferenceDaysCount(countDays);
      } else {
        setBenchmarkAverage(null);
        setReferenceDaysCount(0);
      }
    } catch (e) {
      console.log('Error loading benchmark:', e);
    }
  };

  const checkUserVote = async () => {
    try {
      const stored = await AsyncStorage.getItem(`rated_${ratingKey}`);
      if (stored) {
        setUserScore(parseInt(stored, 10));
      } else {
        const deviceId = await getDeviceId();
        const voteSnap = await getDoc(doc(db, 'ratings', ratingKey, 'votes', deviceId));
        if (voteSnap.exists()) {
          const s = voteSnap.data().score;
          setUserScore(s);
          await AsyncStorage.setItem(`rated_${ratingKey}`, s.toString());
        } else {
          setUserScore(null);
          setSelectedScore(null);
        }
      }
    } catch (e) {
      console.log('Error checking vote:', e);
    }
  };

  const handleVote = async (score: number) => {
    if (userScore !== null) {
      Alert.alert('Bilgi', 'Bu menüyü daha önce puanladınız.');
      return;
    }
    setSubmitting(true);
    try {
      const deviceId = await getDeviceId();
      const ratingDocRef = doc(db, 'ratings', ratingKey);
      const voteDocRef = doc(db, 'ratings', ratingKey, 'votes', deviceId);

      await runTransaction(db, async (transaction) => {
        const voteDoc = await transaction.get(voteDocRef);
        if (voteDoc.exists()) {
          throw new Error('Bu menüyü zaten puanladınız.');
        }

        const ratingDoc = await transaction.get(ratingDocRef);
        let newTotal = score;
        let newCount = 1;

        if (ratingDoc.exists()) {
          const currentTotal = ratingDoc.data().totalScore || 0;
          const currentCount = ratingDoc.data().count || 0;
          newTotal = currentTotal + score;
          newCount = currentCount + 1;
        }

        const newAverage = Math.round((newTotal / newCount) * 10) / 10;

        transaction.set(ratingDocRef, {
          date: dateStr,
          mealType: mealType,
          totalScore: newTotal,
          count: newCount,
          average: newAverage,
          lastUpdated: serverTimestamp(),
        }, { merge: true });

        transaction.set(voteDocRef, {
          score,
          deviceId,
          createdAt: serverTimestamp(),
        });
      });

      setUserScore(score);
      setSelectedScore(null);
      await AsyncStorage.setItem(`rated_${ratingKey}`, score.toString());
      Alert.alert('Teşekkürler!', `${score}/10 puanınız başarıyla kaydedildi.`);
    } catch (e: any) {
      Alert.alert('Bilgi', e.message || 'Puan kaydedilemedi.');
      if (e.message?.includes('zaten')) {
        setUserScore(score);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activeScore = userScore !== null ? userScore : (selectedScore || 0);

  // Önümüzdeki 2 gün boyunca karşılaştırma yapılmaz (referans birikmesi için 2026-10-06 ve sonrası başlar)
  // Ve en az 2 farklı günün puan verisi olmalıdır.
  const isAfterGracePeriod = dateStr >= '2026-10-06';
  const hasEnoughReference = referenceDaysCount >= 2;
  const showComparison = isAfterGracePeriod && hasEnoughReference && ratingData.count > 0 && benchmarkAverage !== null;

  let comparisonStatus: { label: string; bg: string; textColor: string; diffText: string } | null = null;
  if (showComparison && benchmarkAverage !== null) {
    const diff = Math.round((ratingData.average - benchmarkAverage) * 10) / 10;
    if (diff >= 0.3) {
      comparisonStatus = {
        label: 'Ortalamanın Üstünde',
        bg: 'bg-emerald-50 border border-emerald-200',
        textColor: 'text-emerald-700',
        diffText: `+${diff.toFixed(1)} puan yüksek`,
      };
    } else if (diff <= -0.3) {
      comparisonStatus = {
        label: 'Ortalamanın Altında',
        bg: 'bg-rose-50 border border-rose-200',
        textColor: 'text-rose-700',
        diffText: `${diff.toFixed(1)} puan düşük`,
      };
    } else {
      comparisonStatus = {
        label: 'Ortalama Seviyede',
        bg: 'bg-blue-50 border border-blue-200',
        textColor: 'text-blue-700',
        diffText: 'Genel ile dengeli',
      };
    }
  }

  return (
    <View className="mt-5 pt-4 border-t border-gray-100">
      {/* Başlık ve Toplam / Ortalama Puan Göstergesi */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Star size={16} color={accentColor} fill={accentColor} />
          <Text className="text-sm font-bold text-gray-800 ml-1.5">Menü Puanı</Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          {comparisonStatus && (
            <View className={`px-2 py-0.5 rounded-full flex-row items-center ${comparisonStatus.bg}`}>
              <Text className={`text-[10px] font-bold ${comparisonStatus.textColor}`}>
                {comparisonStatus.label}
              </Text>
            </View>
          )}

          {ratingData.count > 0 ? (
            <View className="flex-row items-center bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full">
              <Star size={13} color="#d97706" fill="#d97706" />
              <Text className="text-amber-900 font-extrabold text-xs ml-1">
                {ratingData.average.toFixed(1)} <Text className="font-normal text-amber-700">/ 10</Text>
              </Text>
              <Text className="text-amber-700 text-[11px] ml-1.5">({ratingData.count} oy)</Text>
            </View>
          ) : (
            <View className="bg-gray-100 px-2.5 py-1 rounded-full">
              <Text className="text-gray-500 text-xs">Henüz oy yok</Text>
            </View>
          )}
        </View>
      </View>

      {/* Referans Karşılaştırma Bilgisi (2 gün sonra referans oluşunca görünür) */}
      {comparisonStatus && benchmarkAverage !== null && (
        <View className="flex-row items-center justify-between mb-2.5 py-1 px-2.5 bg-gray-50 border border-gray-100 rounded-xl">
          <Text className="text-[11px] text-gray-500">
            Diğer günlerin ortalaması: <Text className="font-bold text-gray-700">{benchmarkAverage.toFixed(1)} / 10</Text> ({referenceDaysCount} gün)
          </Text>
          <Text className={`text-[11px] font-bold ${comparisonStatus.textColor}`}>
            {comparisonStatus.diffText}
          </Text>
        </View>
      )}

      {/* 10 Yıldız Seçici Barı */}
      <View className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
        <View className="flex-row items-center justify-between">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
            const isFilled = num <= activeScore;
            return (
              <TouchableOpacity
                key={num}
                disabled={userScore !== null || submitting}
                onPress={() => setSelectedScore(num)}
                hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}
                className="items-center justify-center flex-1 py-1"
              >
                <Star
                  size={Platform.OS === 'web' ? 22 : 18}
                  color={isFilled ? '#f59e0b' : '#d1d5db'}
                  fill={isFilled ? '#f59e0b' : 'transparent'}
                />
                <Text className={`text-[10px] font-semibold mt-1 ${isFilled ? 'text-amber-600' : 'text-gray-400'}`}>
                  {num}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Durum veya Onay Butonu */}
        {userScore !== null ? (
          <View className="mt-3 bg-amber-100/60 border border-amber-200/70 rounded-xl py-2 px-3 flex-row items-center justify-center">
            <Star size={14} color="#d97706" fill="#d97706" />
            <Text className="text-amber-800 text-xs font-semibold ml-1.5">
              Puanınız: {userScore} / 10 • Değerlendirmeniz kaydedildi ✓
            </Text>
          </View>
        ) : selectedScore !== null ? (
          <TouchableOpacity
            onPress={() => handleVote(selectedScore)}
            disabled={submitting}
            className="mt-3 bg-amber-500 py-2.5 px-4 rounded-xl flex-row items-center justify-center active:bg-amber-600 shadow-sm"
          >
            <Star size={15} color="white" fill="white" />
            <Text className="text-white font-bold text-sm ml-1.5">
              {submitting ? 'Kaydediliyor...' : `${selectedScore} / 10 Puanı Gönder`}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text className="text-center text-xs text-gray-400 mt-2">
            Puanlamak için bir yıldıza dokunun
          </Text>
        )}
      </View>
    </View>
  );
}

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
            <View className="flex-row items-center flex-1 pr-2">
              <View className="bg-amber-100 p-2 rounded-xl mr-3"><Coffee size={20} color="#d97706" /></View>
              <Text className="text-lg font-bold text-gray-800 flex-shrink" numberOfLines={1}>Sabah Kahvaltısı</Text>
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
          <RatingSection mealType="breakfast" dateStr={activeDateStr} />
          <CommentSection mealType="breakfast" dateStr={activeDateStr} />
        </View>

        {/* Akşam */}
        <View className={`bg-white rounded-3xl p-6 mb-8 shadow-sm border ${isDinnerTime ? 'border-2 border-indigo-400' : 'border-gray-100'}`}>
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-row items-center flex-1 pr-2">
              <View className="bg-indigo-100 p-2 rounded-xl mr-3"><Utensils size={20} color="#4f46e5" /></View>
              <Text className="text-lg font-bold text-gray-800 flex-shrink" numberOfLines={1}>Akşam Yemeği</Text>
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
          <RatingSection mealType="dinner" dateStr={activeDateStr} />
          <CommentSection mealType="dinner" dateStr={activeDateStr} />
        </View>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
