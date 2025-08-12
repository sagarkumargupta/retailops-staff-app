import React, { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'
export default function Signup(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [err,setErr]=useState('')
  const nav=useNavigate()
  const submit=async e=>{
    e.preventDefault()
    try{ await createUserWithEmailAndPassword(auth,email,password); nav('/dashboard') }
    catch(e){ setErr('Signup failed: ' + (e.code||e.message)) }
  }
  return (
    <div className="max-w-md mx-auto card card-pad mt-8">
      <h2 className="text-xl font-bold mb-4">Sign Up</h2>
      <form onSubmit={submit} className="space-y-3">
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2" required/>
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-2" required/>
        <button className="w-full bg-green-600 text-white py-2 rounded">Create Account</button>
      </form>
      {err && <p className="mt-2 text-red-600">{err}</p>}
    </div>
  )
}