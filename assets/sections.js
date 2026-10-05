(()=>{
const P=document.body.dataset.page,$=s=>document.querySelector(s);
if(!$('main'))return;
const st=document.createElement('style');
st.textContent=`
.mv{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:26px}
.mv>div{border-radius:20px;padding:30px}
.mv .m{background:var(--panel);color:var(--dtx)}
.mv .v{background:var(--teal);color:#032421}
.mv h3{font-size:1.25rem;margin-bottom:12px}
.mv .ld{font:600 1.02rem/1.5 'Bricolage Grotesque',sans-serif;margin:0 0 14px;max-width:none}
.mv p{color:inherit;opacity:.9;max-width:none}
.mv p:last-child{margin-bottom:0}
.prom{text-align:center}
.prom .wrap{max-width:820px}
.prom p{margin-inline:auto}
.eq{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px;margin:22px 0 26px}
.eq span{border:1px solid rgba(25,195,176,.5);border-radius:99px;padding:8px 18px;font:600 .95rem 'Bricolage Grotesque',sans-serif;color:#fff}
.eq i{font-style:normal;color:var(--amber);font-weight:700}
.eq .r{background:var(--teal);color:#032421;border-color:var(--teal)}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:24px}
.band{background:var(--card);border-block:1px solid var(--line)}
.hw{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:26px}
.hw>div{background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:22px}
.hw b{display:block;font:700 1.5rem/1 'Bricolage Grotesque',sans-serif;color:var(--teal);margin-bottom:10px}
.hw p{margin:0;color:var(--mute);font-size:.9rem}
@media (max-width:860px){.mv,.grid3,.hw{grid-template-columns:1fr}.mv>div{padding:24px}}
`;
document.head.appendChild(st);
const ic=d=>`<svg viewBox="0 0 48 48" fill="none" stroke="#19c3b0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
if(P===''){
 const t=$('#services');
 if(t)t.insertAdjacentHTML('beforebegin',`<section id="about"><div class="wrap"><h2>Our mission and vision</h2><p class="lede">Security that is not only present, but connected, measurable and responsive.</p>
<div class="mv"><div class="m"><h3>Our Mission</h3><p class="ld">To deliver reliable, professional, and technology-enabled security solutions that protect people, property, and communities while creating complete visibility, accountability, and peace of mind for our clients.</p><p>We combine <b>trained security professionals with smart technology</b> such as GPS tracking, digital visitor management, body-worn cameras, communication systems, patrol monitoring, and incident reporting to provide security that is not only present, but <b>connected, measurable, and responsive</b>.</p><p>Our mission is to continuously improve security standards through <b>people, process, technology, and proactive supervision</b>.</p></div>
<div class="v"><h3>Our Vision</h3><p class="ld">To become one of India’s most trusted and technology-driven security companies, transforming traditional security into a smarter, more transparent, and proactive security experience.</p><p>We envision a future where every residential community, corporate office, commercial property, warehouse, and industrial facility can access <b>professional security backed by real-time technology, intelligent monitoring, and accountable service delivery</b>.</p><p>We want Civic Pulse to be known not simply as a security agency, but as a <b>complete security technology and operations partner</b> that clients can trust every day.</p></div></div></div></section>
<section class="dark prom"><div class="wrap"><h2>Our Promise</h2><div class="eq"><span>People</span><i>+</i><span>Technology</span><i>+</i><span>Accountability</span><i>=</i><span class="r">Smarter Security</span></div><p>We believe great security is not just about having a guard at the gate. It is about having the <b>right people, the right technology, the right processes, and the right response</b> when it matters most.</p></div></section>`);
}
if(P==='security'){
 const g=$('.grid4');
 if(g){
  const sec=g.closest('section');
  sec.querySelector('h2').textContent='Security That You Can See, Track & Trust';
  const C=[['GPS Guard Tracking','Know where your security personnel are during their duty hours.','<path d="M24 44S10 31 10 20a14 14 0 0 1 28 0c0 11-14 24-14 24z"/><circle cx="24" cy="20" r="5"/>'],
  ['Security Mobile App','Attendance, incidents, visitor information and daily operations in one place.','<rect x="14" y="5" width="20" height="38" rx="5"/><path d="M21 37h6"/>'],
  ['Body-Worn Cameras','Greater accountability and transparency at critical security points.','<rect x="6" y="14" width="28" height="20" rx="5"/><path d="M34 22l9-5v14l-9-5"/>'],
  ['Walkie-Talkies','Fast communication between guards, supervisors and emergency teams.','<rect x="14" y="14" width="20" height="30" rx="4"/><path d="M24 14V4M19 9h10M14 22h20M14 30h20"/>'],
  ['Digital Visitor Management','Record visitors, vendors, deliveries, vehicles and entry/exit activity.','<circle cx="24" cy="15" r="7"/><path d="M10 42c0-9 6-15 14-15s14 6 14 15"/>'],
  ['Incident & SOS Reporting','Quick escalation and documented incident management.','<path d="M12 36V26a12 12 0 0 1 24 0v10"/><path d="M8 40h32M24 6v4M8 14l3 3M40 14l-3 3"/>']];
  g.className='grid3';
  g.innerHTML=C.map(c=>`<div class="fc">${ic(c[2])}<h3>${c[0]}</h3><p>${c[1]}</p></div>`).join('');
  const S=[['Recruit & Verify','Background verification and documentation.'],['Train','Security procedures, visitor management, emergency response, communication and customer service.'],['Deploy','Uniformed guards equipped with required communication and technology.'],['Monitor','GPS, attendance, patrols, incidents and supervisor inspections.'],['Report','Daily/weekly/monthly performance reports to the client.'],['Improve','Regular audits and performance reviews.']];
  sec.insertAdjacentHTML('afterend',`<section class="band"><div class="wrap"><h2>How Our Security Works</h2><p class="lede">A clear six-step process behind every post we run.</p><div class="hw">${S.map((s,i)=>`<div><b>0${i+1}</b><h3>${s[0]}</h3><p>${s[1]}</p></div>`).join('')}</div></div></section>`);
 }
}
})();
