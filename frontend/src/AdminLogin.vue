<script setup>
import { ref } from 'vue'
import api from './api'

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function login() {
  if (loading.value) return
  loading.value = true
  error.value = ''

  try {
    const response = await api.post('/login', {
      username: username.value.trim(),
      password: password.value,
    })

    const token = response.data.token || response.data.access_token
    if (!token) throw new Error('Server tidak mengirim token login.')

    localStorage.setItem('admin_token', token)
    localStorage.setItem('admin_user', JSON.stringify(response.data.user || {}))
    window.location.href = '/admin'
  } catch (err) {
    error.value = err.response?.data?.errors?.username?.[0]
      || err.response?.data?.message
      || err.message
      || 'Login gagal. Periksa username dan password.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-card">
      <div class="logo">A</div>
      <p class="eyebrow">AREA PETUGAS</p>
      <h1>Masuk ke dashboard</h1>
      <p class="description">Login untuk memanggil dan mengelola antrean pelanggan.</p>

      <form @submit.prevent="login">
        <label for="username">Username</label>
        <input
          id="username"
          v-model="username"
          type="text"
          autocomplete="username"
          placeholder="Masukkan username"
          maxlength="255"
          required
        />

        <label for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="Masukkan password"
          required
        />

        <p v-if="error" class="alert error" role="alert">{{ error }}</p>
        <button class="btn primary lg" type="submit" :disabled="loading">
          {{ loading ? 'Memproses...' : 'Masuk ke dashboard' }}
        </button>
      </form>

      <a href="/">← Kembali ke halaman pelanggan</a>
    </section>
  </main>
</template>

<style scoped>
.login-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f0f7f5; color: #193b36; font-family: Arial, sans-serif; }
.login-card { width: 100%; max-width: 420px; padding: 32px; border-radius: 18px; background: white; box-shadow: 0 12px 40px #193b3610; box-sizing: border-box; }
.logo { display: grid; width: 46px; height: 46px; margin-bottom: 24px; place-items: center; border-radius: 13px; background: #168578; color: white; font-weight: bold; }
.eyebrow { color: #168578; font-size: 11px; font-weight: bold; letter-spacing: 2px; }
h1 { margin-bottom: 8px; }
.description { margin-bottom: 24px; color: #71847e; font-size: 14px; line-height: 1.6; }
label { display: block; margin: 16px 0 8px; font-size: 13px; font-weight: bold; }
input { width: 100%; padding: 12px; border: 1px solid #d5e3df; border-radius: 8px; box-sizing: border-box; font: inherit; }
button { width: 100%; margin-top: 22px; padding: 13px; border: none; border-radius: 8px; background: #168578; color: white; font-weight: bold; cursor: pointer; }
button:disabled { opacity: .6; cursor: wait; }
.error { color: #b42318; font-size: 13px; }
a { display: block; margin-top: 22px; color: #168578; font-size: 13px; text-decoration: none; }
@media (max-width: 480px) { .login-page { padding: 16px; } .login-card { padding: 24px; } }
</style>
