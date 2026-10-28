<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '../api'

const nama = ref('')
const telepon = ref('')
const setujuWhatsApp = ref(false)
const pengaturanToko = ref({ nama_toko: 'Antrian Digital', deskripsi: 'Layanan lebih mudah, antre lebih nyaman' })
const daftarAntrian = ref([])
const tiketSaya = ref(null)
const loading = ref(false)
const memuatData = ref(false)
const pesanError = ref('')
const pesanSukses = ref('')
const waktuUpdate = ref(new Date())
let intervalRefresh = null
let intervalPengaturan = null

const totalAntrian = computed(() => daftarAntrian.value.length)
const jumlahMenunggu = computed(() => daftarAntrian.value.filter(x => x.status === 'waiting').length)
const antrianBerikutnya = computed(() => daftarAntrian.value.find(x => x.status === 'serving') || null)
const jumlahDiDepan = computed(() => {
  if (!tiketSaya.value || tiketSaya.value.status !== 'waiting') return 0
  return daftarAntrian.value.filter(x => x.status === 'waiting' && Number(x.nomor) < Number(tiketSaya.value.nomor)).length
})
const estimasiMenit = computed(() => jumlahDiDepan.value * 5)
const tiketDipanggil = computed(() => tiketSaya.value?.status === 'serving')
const tiketSelesai = computed(() => ['done', 'skipped', 'cancelled'].includes(tiketSaya.value?.status))

function formatNomor(nomor) { return `A-${String(nomor).padStart(3, '0')}` }
function statusLabel(status) {
  return ({ waiting: 'Menunggu giliran', serving: 'Sedang dilayani', done: 'Selesai', skipped: 'Dilewati', cancelled: 'Dibatalkan' })[status] || status || 'Tidak diketahui'
}
function formatJam(date) { return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }

async function muatPengaturanToko() {
  try {
    const response = await api.get('/pengaturan')
    if (response.data?.data) pengaturanToko.value = { ...pengaturanToko.value, ...response.data.data }
  } catch (error) {
    console.warn('Pengaturan toko belum dapat dimuat:', error)
  }
}

async function muatAntrian() {
  memuatData.value = true
  try {
    const response = await api.get('/antrian')
    daftarAntrian.value = Array.isArray(response.data.data) ? response.data.data : []
    const tiketId = localStorage.getItem('antrian_tiket_id')
    if (tiketId) {
      tiketSaya.value = daftarAntrian.value.find(item => String(item.id) === tiketId) || tiketSaya.value
      if (tiketSaya.value && String(tiketSaya.value.id) === tiketId) {
        // Data tiket yang ditemukan di server adalah sumber status terbaru.
      }
    }
    waktuUpdate.value = new Date()
    pesanError.value = ''
  } catch (error) {
    pesanError.value = error.response?.data?.message || 'Gagal memuat antrean. Pastikan server Laravel berjalan.'
  } finally {
    memuatData.value = false
  }
}

async function ambilNomor() {
  if (loading.value) return
  if (telepon.value.trim() && !setujuWhatsApp.value) {
    pesanError.value = 'Centang persetujuan jika ingin menerima pengingat antrean melalui WhatsApp.'
    return
  }
  loading.value = true
  pesanError.value = ''
  pesanSukses.value = ''
  try {
    const response = await api.post('/antrian', { nama: nama.value.trim() || null, telepon: setujuWhatsApp.value ? (telepon.value.trim() || null) : null })
    tiketSaya.value = response.data.data
    localStorage.setItem('antrian_tiket_id', String(response.data.data.id))
    pesanSukses.value = response.data.message || 'Nomor antrean berhasil diambil.'
    nama.value = ''
    telepon.value = ''
    setujuWhatsApp.value = false
    await muatAntrian()
  } catch (error) {
    pesanError.value = error.response?.data?.message || 'Gagal mengambil nomor antrean. Silakan coba lagi.'
  } finally {
    loading.value = false
  }
}

function ambilNomorBaru() {
  tiketSaya.value = null
  localStorage.removeItem('antrian_tiket_id')
  pesanError.value = ''
  pesanSukses.value = ''
}

onMounted(() => {
  muatPengaturanToko()
  muatAntrian()
  intervalRefresh = setInterval(muatAntrian, 5000)
  intervalPengaturan = setInterval(muatPengaturanToko, 15000)
})
onUnmounted(() => { if (intervalRefresh) clearInterval(intervalRefresh); if (intervalPengaturan) clearInterval(intervalPengaturan) })
</script>

<template>
  <header class="hero">
    <div class="wrap">
      <div class="top">
        <div class="logo">{{ (pengaturanToko.nama_toko || 'A').slice(0, 1).toUpperCase() }}</div>
        <div class="customer-brand"><h1>{{ pengaturanToko.nama_toko || 'Antrian Digital' }}</h1><small>{{ pengaturanToko.deskripsi || 'Layanan lebih mudah, antre lebih nyaman' }}</small></div>
        <div class="sp"></div>
      </div>
    </div>
  </header>

  <main class="main">
    <div class="wrap">
      <section class="card live">
        <div class="lbl">Sedang dilayani</div>
        <div class="big" :class="{ 'not-serving': !antrianBerikutnya }">{{ antrianBerikutnya ? formatNomor(antrianBerikutnya.nomor) : 'Belum ada' }}</div>
        <div class="sub">{{ jumlahMenunggu }} orang sedang menunggu</div>
        <div v-if="antrianBerikutnya" class="small-note" style="margin-top:8px">Silakan menunggu giliran Anda.</div>
      </section>

      <section v-if="!tiketSaya" class="card">
        <h2>Ambil nomor antrean</h2>
        <p class="muted">Isi nama agar petugas mudah memanggil Anda. Nama boleh dikosongkan.</p>
        <form @submit.prevent="ambilNomor">
          <input v-model="nama" class="inp" maxlength="100" placeholder="Nama (opsional)" autocomplete="name" :disabled="loading" />
          <label for="telepon-wa" class="field-label">Nomor WhatsApp <span>(opsional, untuk pengingat antrean)</span></label>
          <input id="telepon-wa" v-model="telepon" class="inp" maxlength="25" type="tel" inputmode="tel" autocomplete="tel" placeholder="Contoh: 081234567890" :disabled="loading" />
          <label class="wa-consent"><input v-model="setujuWhatsApp" type="checkbox" :disabled="loading" /> Saya bersedia menerima pengingat antrean melalui WhatsApp.</label>
          <p class="small-note">Nomor hanya disimpan jika persetujuan dicentang. Petugas mengirim pesan secara manual bila diperlukan.</p>
          <button class="btn primary lg" type="submit" :disabled="loading">{{ loading ? 'Memproses...' : 'Ambil nomor antrean' }}</button>
        </form>
      </section>

      <section v-else-if="tiketDipanggil" class="card turn">
        <div class="lbl">Nomor Anda</div>
        <div class="big">{{ formatNomor(tiketSaya.nomor) }}</div>
        <h2>Giliran Anda!</h2>
        <p style="margin-top:6px;opacity:.92">Silakan menuju petugas untuk mendapatkan layanan.</p>
        <div class="snd"><span class="pill ok">Sedang dilayani</span></div>
      </section>

      <section v-else-if="tiketSelesai" class="card ticket">
        <div class="lbl">Nomor {{ formatNomor(tiketSaya.nomor) }}</div>
        <div style="margin:14px 0"><span class="pill" :class="tiketSaya.status === 'done' ? 'ok' : 'bad'">{{ statusLabel(tiketSaya.status) }}</span></div>
        <p class="muted">{{ tiketSaya.status === 'done' ? 'Terima kasih, layanan Anda telah selesai.' : 'Silakan hubungi petugas jika Anda masih membutuhkan layanan.' }}</p>
        <button class="btn primary lg" style="margin-top:16px" @click="ambilNomorBaru">Ambil nomor baru</button>
      </section>

      <section v-else class="card ticket">
        <div class="lbl">Nomor antrean Anda</div>
        <div class="big">{{ formatNomor(tiketSaya.nomor) }}</div>
        <span class="pill">{{ statusLabel(tiketSaya.status) }}</span>
        <div class="info">
          <div><b>{{ jumlahDiDepan }}</b><span>orang di depan</span></div>
          <div><b>{{ jumlahDiDepan === 0 ? 'Segera' : `±${Math.max(5, estimasiMenit)}` }}</b><span>{{ jumlahDiDepan === 0 ? 'Anda berikutnya' : 'menit perkiraan' }}</span></div>
        </div>
        <p class="muted" style="margin-top:12px">Tidak perlu antre berdiri. Halaman ini diperbarui otomatis setiap 5 detik.</p>
      </section>

      <p v-if="pesanError" class="alert error" role="alert">{{ pesanError }}</p>
      <p v-if="pesanSukses" class="alert success" role="status">{{ pesanSukses }}</p>

      <section class="card">
        <div class="queue-meta">
          <div><h2>Daftar antrean hari ini</h2><p class="muted">Pantau status antrean secara otomatis.</p></div>
          <button class="btn sm" type="button" :disabled="memuatData" @click="muatAntrian">{{ memuatData ? 'Memuat...' : '↻ Refresh' }}</button>
        </div>
        <div class="stats" style="margin-top:18px">
          <div class="stat"><b>{{ totalAntrian }}</b><span>Total antrean</span></div>
          <div class="stat"><b>{{ jumlahMenunggu }}</b><span>Menunggu</span></div>
          <div class="stat"><b>{{ antrianBerikutnya ? formatNomor(antrianBerikutnya.nomor) : 'Belum ada' }}</b><span>Sedang dilayani</span></div>
        </div>
        <ul v-if="daftarAntrian.length" class="list">
          <li v-for="item in daftarAntrian" :key="item.id">
            <span class="chip">{{ formatNomor(item.nomor) }}</span>
            <span class="nm">{{ item.nama || 'Pelanggan' }}<small>{{ statusLabel(item.status) }}</small></span>
            <span class="status" :class="`status-${item.status}`">{{ item.status === 'waiting' ? 'Menunggu' : item.status === 'serving' ? 'Dilayani' : statusLabel(item.status) }}</span>
          </li>
        </ul>
        <div v-else class="empty">{{ memuatData ? 'Memuat data antrean...' : 'Belum ada pelanggan yang mengantre.' }}</div>
        <p class="small-note" style="margin-top:12px">Terakhir diperbarui pukul {{ formatJam(waktuUpdate) }}.</p>
      </section>

      <footer class="customer-footer">{{ pengaturanToko.nama_toko || 'Antrian Digital' }} · {{ pengaturanToko.deskripsi || 'Layanan lebih mudah, antre lebih nyaman' }} <a href="/login">Masuk sebagai petugas</a></footer>
    </div>
  </main>
</template>

<style scoped>
.big.not-serving{font-size:clamp(30px,7vw,46px);letter-spacing:0}.customer-brand{min-width:0}.customer-brand h1{overflow-wrap:anywhere}.customer-brand small{display:block;max-width:100%;line-height:1.4;overflow-wrap:anywhere}.field-label{display:block;margin-top:8px;font-size:13px;font-weight:700;color:var(--ink)}.field-label span{font-weight:400;color:var(--muted)}.wa-consent{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--muted);line-height:1.5;margin:6px 0 8px}.wa-consent input{width:16px;min-width:16px;height:16px;margin:1px 0 0;box-shadow:none}.small-note{font-size:12px;color:var(--muted);line-height:1.5;margin:0 0 12px}
@media(max-width:420px){.customer-brand h1{font-size:17px}.customer-brand small{font-size:12px}}
</style>
