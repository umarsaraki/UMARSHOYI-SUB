const SUPABASE_URL = 'https://lvlbxliuqrgyizxjmmyx.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bGJ4bGl1cXJneWl6eGptbXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDc1OTYsImV4cCI6MjA5OTA4MzU5Nn0.cewsOlpdXupidG2tfiaqOIWvT3FSBgXuW9jQka6JzmA'
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
const MAIN_API = 'https://umarsaraki.onrender.com';
const WALLET_API = 'https://umarsaraki-wallet.onrender.com';
let currentUser = null; let selectedNetwork = "MTN"; let selectedPlan = {}; let transType = "";

function showPage(p){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById(p).classList.add('active')}
function closeModal(){document.getElementById('confirmModal').classList.remove('active');document.getElementById('pinModal').classList.remove('active')}
function copyRef(){navigator.clipboard.writeText(document.getElementById('refCode').innerText)}
function selectNet(el,net){selectedNetwork=net;document.querySelectorAll('.net').forEach(n=>n.classList.remove('active'));el.classList.add('active'); if(transType=='Data'){getPlans('data',net)}}

function detectNetwork(phone, type){
  if(phone.startsWith("0803")||phone.startsWith("0703"))selectedNetwork="MTN";
  if(phone.startsWith("0805")||phone.startsWith("0705"))selectedNetwork="GLO";
  if(phone.startsWith("0802")||phone.startsWith("0701"))selectedNetwork="AIRTEL";
  if(phone.startsWith("0809")||phone.startsWith("0817"))selectedNetwork="9MOBILE";
  let el=document.querySelector(`.net[data-net="${selectedNetwork}"]`); if(el)selectNet(el,selectedNetwork);
  if(type=='data'){ getPlans('data', selectedNetwork) }
}

async function getPlans(type, param){
  let targetDiv = type=='data'?'dataPlans':type=='cable'?'cablePlans':type=='exam'?'examPlans':type+'Plans';
  document.getElementById(targetDiv).innerHTML = "Loading...";
  const res = await fetch(`${MAIN_API}/api/plans?type=${type}&param=${param}`);
  const plans = await res.json();
  let html = "";
  plans.forEach((p, i)=>{
    html += `<div class="plan ${i==0?'active':''}" onclick='selectPlan(this,${JSON.stringify(p)})'><span>${p.name}</span><span>₦${p.amount}</span></div>`;
  })
  document.getElementById(targetDiv).innerHTML = html;
  if(plans.length>0) selectedPlan = plans[0];
}

function selectPlan(el,plan){selectedPlan=plan;el.parentElement.querySelectorAll('.plan').forEach(p=>p.classList.remove('active'));el.classList.add('active')}

function showConfirm(type){
  transType=type; let detail="", amount="";
  if(type=='Data'){detail=document.getElementById('dataPhone').value; amount=`₦${selectedPlan.amount}`;}
  if(type=='Airtime'){detail=document.getElementById('airtimePhone').value; amount=`₦${document.getElementById('airtimeAmount').value}`;}
  document.getElementById('cNet').innerText=selectedNetwork;
  document.getElementById('cDetail').innerText=detail;
  document.getElementById('cAmount').innerText=amount;
  document.getElementById('confirmModal').classList.add('active');
}
function showPin(){document.getElementById('confirmModal').classList.remove('active');document.getElementById('pinModal').classList.add('active')}

async function submitPin(){
  let pin = document.getElementById('pinInput').value;
  let payload = {type: transType, network: selectedNetwork, plan: selectedPlan, pin: pin, user_id: currentUser.id}
  const res = await fetch(`${MAIN_API}/api/buy`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)})
  const data = await res.json();
  closeModal();
  document.getElementById('loginError').innerText = data.message;
  getBalance();
}

function fundWallet(){
  let amount = document.getElementById('fundAmount').value;
  window.location.href = `${WALLET_API}/pay?amount=${amount}&user=${currentUser.id}`;
}

async function registerUser(){
  if(document.getElementById('regPassword').value!== document.getElementById('regConfirmPassword').value){document.getElementById('regError').innerText="Passwords do not match";return}
  const {error} = await supabaseClient.auth.signUp({email:document.getElementById('regEmail').value,password:document.getElementById('regPassword').value,options:{data:{username:document.getElementById('regUsername').value}}})
  if(error){document.getElementById('regError').innerText="Registration Failed"}else{showPage('loginPage')}
}
async function loginUser(){
  const {data,error} = await supabaseClient.auth.signInWithPassword({email:document.getElementById('loginEmail').value,password:document.getElementById('loginPassword').value})
  if(error){document.getElementById('loginError').innerText="Login Failed"}else{
    currentUser=data.user;showPage('dashboardPage');
    let username=data.user_metadata.username;
    document.getElementById('username').innerText=username.toUpperCase();
    document.getElementById('profileName').innerText=username.toUpperCase();
    document.getElementById('refCode').innerText=username;
    getBalance();
  }
}
async function logout(){await supabaseClient.auth.signOut();window.location.href='index.html'}
async function getBalance(){
  if(!currentUser) return;
  const res = await fetch(`${MAIN_API}/api/balance?user_id=${currentUser.id}`);
  const data = await res.json();
  document.getElementById('balance').innerText = parseFloat(data.balance).toFixed(2)
}
function convertAirtime(){}
function toggleBio(){}
function changePin(){}
function changePassword(){}

supabaseClient.auth.getSession().then(({ data: { session }}) => {
  if(session && document.getElementById('refCode')){
    currentUser=session.user;
    showPage('dashboardPage');
    let u=session.user_metadata.username;
    document.getElementById('refCode').innerText=u;
    if(document.getElementById('profileName')) document.getElementById('profileName').innerText=u.toUpperCase();
    getBalance();
  }
})
