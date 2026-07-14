import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts"

const SUPABASE_URL = "https://lvlbxliuqrgyizxjmmyx.supabase.co"
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const FLW_SECRET = Deno.env.get("FLW_SECRET")!
const FLW_SECRET_HASH = "UMARSHOYI_SUB_0891"

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const KEYS = {
  flw_secret: FLW_SECRET,
  airtime: Deno.env.get("NELLobyte_AIRTIME")!,
  data: Deno.env.get("NELLobyte_DATA")!,
  cable: Deno.env.get("NELLobyte_CABLE")!,
  light: Deno.env.get("NELLobyte_LIGHT")!,
  airtime_card: Deno.env.get("NELLobyte_AIRTIME_CARD")!,
  data_card: Deno.env.get("NELLobyte_DATA_CARD")!,
  waec: Deno.env.get("NELLobyte_WAEC")!,
  jam: Deno.env.get("NELLobyte_JAM")!,
}
const USER_ID = Deno.env.get("NELLobyte_USER")!
const PROFIT = { per_gb: 50, cable: 100, light: 50, exam: 100, card: 50 }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, verif-hash",
}

// 1. FUNCTION DON DUBA PIN
async function verifyPin(user_id: string, pin: string) {
  const { data } = await supabase.from('users').select('transaction_pin').eq('id', user_id).single()
  return data?.transaction_pin === pin
}

// 2. FUNCTION DON AJIYE HISTORY
async function saveHistory(user_id: string, amount: number, type: string, service: string, status: string, details: any) {
  await supabase.from('transactions').insert({
    user_id, 
    amount: type === "debit" ? -amount : amount, 
    type: type, 
    service: service,
    status: status, 
    details: details,
    created_at: new Date().toISOString()
  })
}

// 3. FUNCTION DON RAGE KUDI DAGA WALLET
async function deductWallet(user_id: string, amount: number) {
  const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user_id).single()
  if(!wallet || wallet.balance < amount) return {success: false, message: "Insufficient balance"}
  const newBalance = wallet.balance - amount
  await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', user_id)
  return {success: true, new_balance: newBalance}
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  try {
    // ========== ACCOUNT MANAGEMENT ==========
    
    // 10. CHANGE PASSWORD
    if(type === "change_password"){
      const { user_id, old_password, new_password } = await req.json();
      const { data: user } = await supabase.from('users').select('password').eq('id', user_id).single()
      const valid = await bcrypt.compare(old_password, user.password)
      if(!valid) return new Response(JSON.stringify({success: false, message: "Old password incorrect"}), {status: 401, headers: corsHeaders})
      const hash = await bcrypt.hash(new_password)
      await supabase.from('users').update({password: hash}).eq('id', user_id)
      return new Response(JSON.stringify({success: true, message: "Password changed"}), {headers: corsHeaders})
    }

    // 11. CHANGE TRANSACTION PIN
    if(type === "change_pin"){
      const { user_id, old_pin, new_pin } = await req.json();
      if(!await verifyPin(user_id, old_pin)) return new Response(JSON.stringify({success: false, message: "Old PIN incorrect"}), {status: 401, headers: corsHeaders})
      await supabase.from('users').update({transaction_pin: new_pin}).eq('id', user_id)
      return new Response(JSON.stringify({success: true, message: "PIN changed"}), {headers: corsHeaders})
    }

    // 12. BIOMETRIC LOGIN - Ajiye key na yatsa
    if(type === "biometric_setup"){
      const { user_id, biometric_key } = await req.json(); // key din zai fito daga app
      await supabase.from('users').update({biometric_key: biometric_key}).eq('id', user_id)
      return new Response(JSON.stringify({success: true}), {headers: corsHeaders})
    }
    
    // 13. LOGIN DA BIOMETRIC
    if(type === "biometric_login"){
      const { user_id, biometric_key } = await req.json();
      const { data: user } = await supabase.from('users').select('biometric_key').eq('id', user_id).single()
      if(user?.biometric_key === biometric_key) return new Response(JSON.stringify({success: true, message: "Login success"}), {headers: corsHeaders})
      return new Response(JSON.stringify({success: false, message: "Biometric failed"}), {status: 401, headers: corsHeaders})
    }

    // 14. GET HISTORY CENTER
    if(type === "get_history"){
      const { user_id } = await req.json();
      const { data } = await supabase.from('transactions').select('*').eq('user_id', user_id).order('created_at', {ascending: false})
      return new Response(JSON.stringify({success: true, data: data}), {headers: {...corsHeaders, "Content-Type": "application/json"}})
    }

    // ========== 0. FLUTTERWAVE WEBHOOK ==========
    const signature = req.headers.get("verif-hash")
    if (signature && signature === FLW_SECRET_HASH) {
      const payload = await req.json()
      if (payload.event === "charge.completed" && payload.data.status === "successful") {
        const userId = payload.data.meta?.user_id
        const amount = payload.data.amount
        const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', userId).single()
        const newBalance = (wallet?.balance || 0) + amount
        await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', userId)
        await saveHistory(userId, amount, "credit", "Wallet Funding", "success", {ref: payload.data.tx_ref})
        return new Response(JSON.stringify({ status: "success" }), { status: 200 })
      }
    }

    // ========== 1. FUND WALLET ==========
    if(type === "fund_wallet"){
      const { user_id, email, amount } = await req.json();
      const res = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {"Authorization": `Bearer ${KEYS.flw_secret}`, "Content-Type": "application/json"},
        body: JSON.stringify({
          tx_ref: `wallet-${user_id}-${Date.now()}`,
          amount: amount, currency: "NGN",
          redirect_url: "myapp://payment-success",
          customer: {email: email}, meta: {user_id: user_id}
        })
      })
      const data = await res.json()
      return new Response(JSON.stringify({link: data.data.link}), {headers: {...corsHeaders, "Content-Type": "application/json"}})
    }

    // ========== 2. GET DATA PLANS ==========
    if(type === "data_plans"){
      const res = await fetch(`https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=${USER_ID}&APIKey=${KEYS.data}`)
      const plans = await res.json()
      const result = plans.map((p: any) => {
        const gbMatch = p.plan_name.match(/([\d.]+)\s*GB/i);
        const gb = gbMatch? parseFloat(gbMatch[1]) : 1;
        const profit = gb * PROFIT.per_gb;
        return {...p, gb: gb, profit: profit, selling_price: Number(p.amount) + profit}
      })
      return new Response(JSON.stringify({success: true, data: result}), {headers: {...corsHeaders, "Content-Type": "application/json"}})
    }

    // ========== 3. BUY DATA ==========
    if(type === "buy_data"){
      const body = await req.json(); 
      const details = {phone: body.phone, plan_code: body.plan_code, network: body.network, service: "Data"}
      if(!await verifyPin(body.user_id, body.pin)) {await saveHistory(body.user_id, body.amount, "debit", "Data", "failed_pin", details); return new Response(JSON.stringify({success: false, message: "Wrong PIN"}), {status: 401, headers: corsHeaders})}
      const deduct = await deductWallet(body.user_id, body.amount)
      if(!deduct.success) {await saveHistory(body.user_id, body.amount, "debit", "Data", "insufficient", details); return new Response(JSON.stringify(deduct), {status: 400, headers: corsHeaders})}
      await saveHistory(body.user_id, body.amount, "debit", "Data", "pending", details)
      const buyUrl = `https://www.nellobytesystems.com/APIDatabundleNetworkV2.asp?UserID=${USER_ID}&APIKey=${KEYS.data}&mobile=${body.phone}&plan=${body.plan_code}`
      const res = await fetch(buyUrl)
      const result = await res.json()
      const finalStatus = result.status === "success" ? "success" : "rejected"
      await supabase.from('transactions').update({status: finalStatus}).eq('user_id', body.user_id).eq('status', 'pending').order('created_at', {ascending: false}).limit(1)
      return new Response(JSON.stringify(result), {headers: {...corsHeaders, "Content-Type": "application/json"}})
    }

    // ========== 4. BUY AIRTIME ==========
    if(type === "buy_airtime"){
      const body = await req.json(); 
      const details = {phone: body.phone, amount: body.amount, network: body.network, service: "Airtime"}
      if(!await verifyPin(body.user_id, body.pin)) {await saveHistory(body.user_id, body.amount, "debit", "Airtime", "failed_pin", details); return new Response(JSON.stringify({success: false, message: "Wrong PIN"}), {status: 401, headers: corsHeaders})}
      const deduct = await deductWallet(body.user_id, body.amount)
      if(!deduct.success) {await saveHistory(body.user_id, body.amount, "debit", "Airtime", "insufficient", details); return new Response(JSON.stringify(deduct), {status: 400, headers: corsHeaders})}
      await saveHistory(body.user_id, body.amount, "debit", "Airtime", "pending", details)
      const buyUrl = `https://www.nellobytesystems.com/APIAirtimeNetworkV2.asp?UserID=${USER_ID}&APIKey=${KEYS.airtime}&mobile=${body.phone}&amount=${body.amount}&network=${body.network}`
      const res = await fetch(buyUrl)
      const result = await res.json()
      const finalStatus = result.status === "success" ? "success" : "rejected"
      await supabase.from('transactions').update({status: finalStatus}).eq('user_id', body.user_id).eq('status', 'pending').order('created_at', {ascending: false}).limit(1)
      return new Response(JSON.stringify(result), {headers: {...corsHeaders, "Content-Type": "application/json"}})
    }

    // ========== 5. BUY AIRTIME CARD ==========
    if(type === "buy_airtime_card"){
      const body = await req.json(); 
      const details = {network: body.network, qty: body.qty, service: "Airtime Card"}
      if(!await verifyPin(body.user_id, body.pin)) {await saveHistory(body.user_id, body.amount, "debit", "Airtime Card", "failed_pin", details); return new Response(JSON.stringify({success: false, message: "Wrong PIN"}), {status: 401, headers: corsHeaders})}
      const deduct = await deductWallet(body.user_id, body.amount)
      if(!deduct.success) {await saveHistory(body.user_id, body.amount, "debit", "Airtime Card", "insufficient", details); return new Response(JSON.stringify(deduct), {status: 400, headers: corsHeaders})}
      await saveHistory(body.user_id, body.amount, "debit", "Airtime Card", "pending", details)
      const buyUrl = `https://www.nellobytesystems.com/APIAirtimeVouchers.asp?UserID=${USER_ID}&APIKey=${KEYS.airtime_card}&Network=${body.network}&Qty=${body.qty}`
      const res = await fetch(buyUrl)
      const result = await res.json()
      const finalStatus = result.status === "success" ? "success" : "rejected"
      await supabase.from('transactions').update({status: finalStatus, details: {...details, pins: result.pins}}).eq('user_id', body.user_id).eq('status', 'pending').order('created_at', {ascending: false}).limit(1)
      return new Response(JSON.stringify(result), {headers: {...corsHeaders, "Content-Type": "application/json"}})
    }

    // ========== 6. BUY DATA CARD ==========
    if(type === "buy_data_card"){
      const body = await req.json(); 
      const details = {network: body.network, plan: body.plan, qty: body.qty, service: "Data Card"}
      if(!await verifyPin(body.user_id, body.pin)) {await saveHistory(body.user_id, body.amount, "debit", "Data Card", "failed_pin", details); return new Response(JSON.stringify({success: false, message: "Wrong PIN"}), {status: 401, headers: corsHeaders})}
      const deduct = await deductWallet(body.user_id, body.amount)
      if(!deduct.success) {await saveHistory(body.user_id, body.amount, "debit", "Data Card", "insufficient", details); return new Response(JSON.stringify(deduct), {status: 400, headers: corsHeaders})}
      await saveHistory(body.user_id, body.amount, "debit", "Data Card", "pending", details)
      const buyUrl = `https://www.nellobytesystems.com/APIDatabundleVouchers.asp?UserID=${USER_ID}&APIKey=${KEYS.data_card}&Network=${body.network}&Plan=${body.plan}&Qty=${body.qty}`
      const res = await fetch(buyUrl)
      const result = await res.json()
      const finalStatus = result.status === "success" ? "success" : "rejected"
      await supabase.from('transactions').update({status: finalStatus, details: {...details, pins: result.pins}}).eq('user_id', body.user_id).eq('status', 'pending').order('created_at', {ascending: false}).limit(1)
      return new Response(JSON.stringify(result), {headers: {...corsHeaders, "Content-Type": "application/json"}})
    }

    // ========== 7. BUY EXAM ==========
    if(type === "buy_exam"){
      const body = await req.json(); 
      const details = {exam: body.exam, service: "Exam Pin"}
      if(!await verifyPin(body.user_id, body.pin)) {await saveHistory(body.user_id, body.amount, "debit", "Exam Pin", "failed_pin", details); return new Response(JSON.stringify({success: false, message: "Wrong PIN"}), {status: 401, headers: corsHeaders})}
      const deduct = await deductWallet(body.user_id, body.amount)
      if(!deduct.success) {await saveHistory(body.user_id, body.amount, "debit", "Exam Pin", "insufficient", details); return new Response(JSON.stringify(deduct), {status: 400, headers: corsHeaders})}
      await saveHistory(body.user_id, body.amount, "debit", "Exam Pin", "pending", details)
      let buyUrl = body.exam === "waec" ? `https://www.nellobytesystems.com/APIWaecPinV2.asp?UserID=${USER_ID}&APIKey=${KEYS.waec}` : `https://www.nellobytesystems.com/APIJambPinV2.asp?UserID=${USER_ID}&APIKey=${KEYS.jam}`;
      const res = await fetch(buyUrl)
      const result = await res.json()
      const finalStatus = result.status === "success" ? "success" : "rejected"
      await supabase.from('transactions').update({status: finalStatus, details: {...details, pin: result.pin}}).eq('user_id', body.user_id).eq('status', 'pending').order('created_at', {ascending: false}).limit(1)
      return new Response(JSON.stringify(result), {headers: {...corsHeaders, "Content-Type": "application/json"}})
    }

    // ========== 8. BUY CABLE ==========
    if(type === "buy_cable"){
      const body = await req.json(); 
      const details = {smart_card: body.smart_card, biller: body.biller_code, service: "Cable TV"}
      if(!await verifyPin(body.user_id, body.pin)) {await saveHistory(body.user_id, body.amount, "debit", "Cable TV", "failed_pin", details); return new Response(JSON.stringify({success: false, message: "Wrong PIN"}), {status: 401, headers: corsHeaders})}
      const deduct = await deductWallet(body.user_id, body.amount)
      if(!deduct.success) {await saveHistory(body.user_id, body.amount, "debit", "Cable TV", "insufficient", details); return new Response(JSON.stringify(deduct), {status: 400, headers: corsHeaders})}
      await saveHistory(body.user_id, body.amount, "debit", "Cable TV", "pending", details)
      const buyUrl = `https://www.nellobytesystems.com/APIBillPayment.asp?UserID=${USER_ID}&APIKey=${KEYS.cable}&BillerID=${body.biller_code}&ItemCode=${body.item_code}&VariationCode=${body.smart_card}&Amount=${body.amount}`
      const res = await fetch(buyUrl)
      const result = await res.json()
      const finalStatus = result.status === "success" ? "success" : "rejected"
      await supabase.from('transactions').update({status: finalStatus}).eq('user_id', body.user_id).eq('status', 'pending').order('created_at', {ascending: false}).limit(1)
      return new Response(JSON.stringify(result), {headers: {...corsHeaders, "Content-Type": "application/json"}})
    }

    // ========== 9. BUY LIGHT ==========
    if(type === "buy_light"){
      const body = await req.json(); 
      const details = {meter_no: body.meter_no, biller: body.biller_code, service: "Electricity"}
      if(!await verifyPin(body.user_id, body.pin)) {await saveHistory(body.user_id, body.amount, "debit", "Electricity", "failed_pin", details); return new Response(JSON.stringify({success: false, message: "Wrong PIN"}), {status: 401, headers: corsHeaders})}
      const deduct = await deductWallet(body.user_id, body.amount)
      if(!deduct.success) {await saveHistory(body.user_id, body.amount, "debit", "Electricity", "insufficient", details); return new Response(JSON.stringify(deduct), {status: 400, headers: corsHeaders})}
      await saveHistory(body.user_id, body.amount, "debit", "Electricity", "pending", details)
      const buyUrl = `https://www.nellobytesystems.com/APIBillPayment.asp?UserID=${USER_ID}&APIKey=${KEYS.light}&BillerID=${body.biller_code}&ItemCode=${body.item_code}&VariationCode=${body.meter_no}&Amount=${body.amount}`
      const res = await fetch(buyUrl)
      const result = await res.json()
      const finalStatus = result.status === "success" ? "success" : "rejected"
      await supabase.from('transactions').update({status: finalStatus}).eq('user_id', body.user_id).eq('status', 'pending').order('created_at', {ascending: false}).limit(1)
      return new Response(JSON.stringify(result), {headers: {...corsHeaders, "Content-Type": "application/json"}})
    }

    return new Response(JSON.stringify({success: false, message: "Invalid type"}), {status: 400, headers: corsHeaders})

  } catch (e) {
    return new Response(JSON.stringify({success: false, error: e.message}), {status: 500, headers: corsHeaders})
  }
})
