import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AdminLogin from '../AdminLogin.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'admin-login', component: AdminLogin },
    { path: '/admin', name: 'admin-dashboard', component: () => import('../AdminDashboard.vue'), meta: { requiresAuth: true } },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('antrian_token')
  if (to.meta.requiresAuth && !token) return { name: 'admin-login' }
  if (to.name === 'admin-login' && token) return { name: 'admin-dashboard' }
})

export default router
