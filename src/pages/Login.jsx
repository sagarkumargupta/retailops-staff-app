import React, { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { Link, useNavigate } from 'react-router-dom'
export default function Login(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [err,setErr]=useState('')
  const nav=useNavigate()
  const submit=async e=>{
    e.preventDefault()
    try{ await signInWithEmailAndPassword(auth,email,password); nav('/dashboard') }
    catch(e){ setErr('Login failed: ' + (e.code||e.message)) }
  }
  return (
    <div className="max-w-md mx-auto card card-pad mt-8">
      <h2 className="text-xl font-bold mb-4">Login</h2>
      <form onSubmit={submit} className="space-y-3">
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2" required/>
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-2" required/>
        <button className="w-full bg-blue-600 text-white py-2 rounded">Sign In</button>
      </form>
      {err && <p className="mt-2 text-red-600">{err}</p>}
      <p className="mt-2 text-sm">No account? <Link to="/signup" className="text-blue-600">Sign Up</Link> • <Link to="/forgot-password" className="text-blue-600">Forgot?</Link></p>
    </div>
  )
}