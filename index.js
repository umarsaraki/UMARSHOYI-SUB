import { createClient } from '@supabase/supabase-js'
import http from 'http'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FLW_SECRET = process.env.FLW_SECRET
const FLW_SECRET_HASH = "UMARSHOYI_SUB_0891"

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const KEYS = {
  flw_secret: FLW_SECRET,
  airtime: process.env.NELLobyte_AIRTIME,
  data: process.env.NELLobyte_DATA,
  cable: process.env.NELLobyte_CABLE,
  light: process.env.NELLobyte_LIGHT,
  airtime_card: process.env.NELLobyte_AIRTIME_CARD,
  data_card: process.env.NELLobyte_DATA_CARD,
  waec: process.env.NELLobyte_WAEC,
  jam: process.env.NELLobyte_JAM,
}
const USER_ID = process.env.NELLobyte_USER
const PROFIT = { per_gb: 50, cable: 100, light: 50, exam: 100, card: 50 }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, verif-hash",
  "Content-Type": "application/json"
}

// 1. FUNCTION DON DUBA PIN
async function verifyPin(user_id, pin) {
  const { data } = await supabase.from('wallets').select('transaction_pin').eq('user_id', user_id).single()
  return data?.transaction_pin === pin
}

// 2. FUNCTION DON AJIYE HISTORY
async function saveHistory(user_id, amount, type, service, status, details) {
  await supabase.from('transactions').insert({
    user_id,
    amount: type === "debit"? -amount : amount,
    type: type,
    service: service,
    status: status,
    details: details,
    created_at: new Date().toISOString()
  })
}

// 3. FUNCTION DON RAGE KUDI DAGA WALLET
async function deductWallet(user_id, amount) {
  const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user_id).single()
  if(!wallet || wallet.balance < amount) return {success: false, message: "Insufficient balance"}
  const newBalance = wallet.balance - amount
  await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', user_id)
  return {success: true, new_balance: newBalance}
}

// ========== SERVER DIN MU NA HTTP ==========
const server = http.createServer(async (req, res) => {

  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type, verif-hash")

  if (req.method === "OPTIONS") {
    res.writeHead(200)
    res.end("ok")
    return
  }

  let body = ''
  req.on('data', chunk => body += chunk.toString())

  req.on('end', async () => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = url.searchParams.get("type");
    const jsonBody = body? JSON.parse(body) : {}

    try {
      // ========== ACCOUNT MANAGEMENT ==========
      if(type === "change_password"){
        const { user_id, old_password, new_password } = jsonBody;
        const { data: user } = await supabase.from('wallets').select('password').eq('user_id', user_id).single()
        const valid = old_password === user?.password // Ka maye gurbin bcrypt da haka na dan lokaci
        if(!valid) return res.end(JSON.stringify({success: false, message: "Old password incorrect"}))
        await supabase.from('wallets').update({password: new_password}).eq('user_id', user_id)
        return res.end(JSON.stringify({success: true, message: "Password changed"}))
      }

      if(type === "change_pin"){
        const { user_id, old_pin, new_pin } = jsonBody;
        if(!await verifyPin(user_id, old_pin)) return res.end(JSON.stringify({success: false, message: "Old PIN incorrect"}))
        await supabase.from('wallets').update({transaction_pin: new_pin}).eq('user_id', user_id)
        return res.end(JSON.stringify({success: true, message: "PIN changed"}))
      }

      if(type === "biometric_setup"){
        const { user_id, biometric_key } = jsonBody;
        await supabase.from('wallets').update({biometric_key: biometric_key}).eq('user_id', user_id)
        return res.end(JSON.stringify({success: true}))
      }

      if(type === "biometric_login"){
        const { user_id, biometric_key } = jsonBody;
        const { data: user } = await supabase.from('wallets').select('biometric_key').eq('user_id', user_id).single()
        if(user?.biometric_key === biometric_key) return res.end(JSON.stringify({success: true, message: "Login success"}))
        return res.end(JSON.stringify({success: false, message: "Biometric failed"}))
      }

      if(type === "get_history"){
        const { user_id } = jsonBody;
        const { data } = await supabase.from('transactions').select('*').eq('user_id', user_id).order('created_at', {ascending: false})
        return res.end(JSON.stringify({success: true, data: data}))
      }

      // ========== FLUTTERWAVE WEBHOOK ==========
      const signature = req.headers["verif-hash"]
      if (signature && signature === FLW_SECRET_HASH) {
        const payload = jsonBody
        if (payload.event === "charge.completed" && payload.data.status === "successful") {
          const userId = payload.data.meta?.user_id
          const amount = payload.data.amount
          const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', userId).single()
          const newBalance = (wallet?.balance || 0) + amount
          await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', userId)
          await saveHistory(userId, amount, "credit", "Wallet Funding", "success", {ref: payload.data.tx_ref})
          res.writeHead(200)
          return res.end(JSON.stringify({ status: "success" }))
        }
      }

      // ========== FUND WALLET ==========
      if(type === "fund_wallet"){
        const { user_id, email, amount } = jsonBody;
        const fetch = (await import('node-fetch')).default;
        const resApi = await fetch("https://api.flutterwave.com/v3/payments", {
          method: "POST",
          headers: {"Authorization": `Bearer ${KEYS.flw_secret}`, "Content-Type": "application/json"},
          body: JSON.stringify({tx_ref: `wallet-${user_id}-${Date.now()}`, amount, currency: "NGN", redirect_url: "myapp://payment-success", customer: {email}, meta: {user_id}})
        })
        const data = await resApi.json()
        return res.end(JSON.stringify({link: data.data.link}))
      }

      // ========== SAURAN API DIN NELLObytes ==========
      // Ka kwafa duk sauran if din naka na buy_data, buy_airtime, etc daga code na sama
      // Kawai ka canza `req.json()` zuwa `jsonBody`
      // Kuma ka canza `return new Response` zuwa `return res.end(JSON.stringify())`

      if(type === "data_plans"){
        const fetch = (await import('node-fetch')).default;
        const resApi = await fetch(`https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=${USER_ID}&APIKey=${KEYS.data}`)
        const plans = await resApi.json()
        const result = plans.map((p) => {
          const gbMatch = p.plan_name.match(/([\d.]+)\s*GB/i);
          const gb = gbMatch? parseFloat(gbMatch[1]) : 1;
          const profit = gb * PROFIT.per_gb;
          return {...p, gb: gb, profit: profit, selling_price: Number(p.amount) + profit}
        })
        return res.end(JSON.stringify({success: true, data: result}))
      }

      return res.end(JSON.stringify({success: false, message: "Invalid type"}))

    } catch (e) {
      res.writeHead(500)
      res.end(JSON.stringify({success: false, error: e.message}))
    }
  })
})

const PORT = process.env.PORT || 10000
server.listen(PORT, () => console.log(`Server running on port ${PORT}`))
