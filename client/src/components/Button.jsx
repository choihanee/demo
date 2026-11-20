// [박민서] 공통 버튼
export default function Button({ children, variant = 'primary', ...props }) {
  const styles = { primary: 'bg-violet-600 text-white hover:bg-violet-700', ghost: 'bg-white border border-violet-200 text-violet-700 hover:bg-violet-50' }
  return <button className={`px-5 py-2.5 rounded-xl font-semibold transition disabled:opacity-40 ${styles[variant]}`} {...props}>{children}</button>
}
