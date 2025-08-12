import React, { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase'
export default function ForgotPassword(){
  const [email,setEmail]=useState('')
  const [msg,setMsg]=useState('')
  const submit=async e=>{
    e.preventDefault()
    try{ await sendPasswordResetEmail(auth,email); setMsg('Reset link sent') }
    catch(e){ setMsg('Failed: '+(e.code||e.message)) }
  }
  return (
    <div className="max-w-md mx-auto card card-pad mt-8">
      <h2 className="text-xl font-bold mb-4">Forgot Password</h2>
      <form onSubmit={submit} className="space-y-3">
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2" required/>
        <button className="w-full bg-blue-600 text-white py-2 rounded">Send Reset</button>
      </form>
      {msg && <p className="mt-2">{msg}</p>}
    </div>
  )
}