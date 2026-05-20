import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ClipboardList, LogIn, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      const user = useAuthStore.getState().user
      if (user?.frozen_at) {
        navigate('/frozen')
      } else {
        navigate('/projects')
      }
    } catch {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-100 rounded-xl mb-4">
            <ClipboardList className="w-7 h-7 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">مرحباً بك في إنجاز</h1>
          <p className="text-gray-500 text-sm mt-1">نظام إدارة المهام والمشاريع</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
            <input
              id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              placeholder="admin@ingaz.com" required
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
            <div className="relative">
              <input
                id="login-password" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm pl-10"
                placeholder="••••••••" required
              />
              <button type="button" onClick={() => setShow(!show)} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium flex items-center justify-center gap-2">
            {loading ? 'جاري تسجيل الدخول...' : <>تسجيل الدخول <LogIn className="w-4 h-4" /></>}
          </button>
        </form>

        {import.meta.env.DEV && (
          <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-2">
            <p className="font-medium mb-1">🧪 اختيار حساب تجريبي:</p>
            <select
              onChange={e => {
                if (!e.target.value) return;
                const [email, password] = e.target.value.split('|');
                setEmail(email);
                setPassword(password);
              }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              defaultValue="">
              <option value="" disabled>-- اختر مستخدم --</option>
              <optgroup label="🛡️ مدراء">
                <option value="admin@ingaz.com|admin123">المدير العام (admin@ingaz.com)</option>
                <option value="ahmed@ingaz.com|ahmed123">أحمد الشريف (ahmed@ingaz.com)</option>
              </optgroup>
              <optgroup label="⚡ نواب">
                <option value="deputy@ingaz.com|deputy123">نائب المدير (deputy@ingaz.com)</option>
                <option value="sara@ingaz.com|sara123">سارة النمر (sara@ingaz.com)</option>
              </optgroup>
              <optgroup label="👤 موظفين">
                <option value="emp@ingaz.com|emp123">موظف نموذجي (emp@ingaz.com)</option>
                <option value="mohamed@ingaz.com|mohamed123">محمد العبدالله (mohamed@ingaz.com)</option>
                <option value="noura@ingaz.com|noura123">نورة السعيد (noura@ingaz.com)</option>
                <option value="khalid@ingaz.com|khalid123">خالد المطيري (khalid@ingaz.com)</option>
                <option value="mona@ingaz.com|mona123">منى الحربي (mona@ingaz.com)</option>
                <option value="faisal@ingaz.com|faisal123">فيصل الدوسري (faisal@ingaz.com)</option>
                <option value="hind@ingaz.com|hind123">هند القحطاني (hind@ingaz.com)</option>
                <option value="sami@ingaz.com|sami123">سامي الزهراني (sami@ingaz.com)</option>
                <option value="laila@ingaz.com|laila123">ليلى الغامدي (laila@ingaz.com)</option>
                <option value="yusuf@ingaz.com|yusuf123">يوسف الأنصاري (yusuf@ingaz.com)</option>
                <option value="rana@ingaz.com|rana123">رنا الشمري (rana@ingaz.com)</option>
                <option value="majed@ingaz.com|majed123">ماجد العتيبي (majed@ingaz.com)</option>
                <option value="dana@ingaz.com|dana123">دينا بكر (dana@ingaz.com)</option>
                <option value="turki@ingaz.com|turki123">تركي الزهراني (turki@ingaz.com)</option>
                <option value="salma@ingaz.com|salma123">سلمى الشهراني (salma@ingaz.com)</option>
                <option value="badr@ingaz.com|badr123">بدر الحارثي (badr@ingaz.com)</option>
                <option value="huda@ingaz.com|huda123">هدى الغامدي (huda@ingaz.com)</option>
                <option value="nasser@ingaz.com|nasser123">ناصر السبيعي (nasser@ingaz.com)</option>
                <option value="amani@ingaz.com|amani123">أماني الزهراني (amani@ingaz.com)</option>
                <option value="saad@ingaz.com|saad123">سعد القحطاني (saad@ingaz.com)</option>
                <option value="layan@ingaz.com|layan123">ليان الشريف (layan@ingaz.com)</option>
              </optgroup>
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
