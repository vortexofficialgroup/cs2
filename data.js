// ═══════════════════════════════════════════════════
// UE DUBAI CAMPUS — Room Portal Data Layer
// ═══════════════════════════════════════════════════

let ROOMS = [
  // Real rooms from the campus list (single floor)
  { id:'202',  name:'Lecture Theatre 202', floor:1, type:'Lecture Theatre', capacity:60, features:['Biggest room'], bookable:true },
  { id:'204',  name:'Auditorium 204',      floor:1, type:'Auditorium',      capacity:45, features:['Opens into 205'], bookable:true, mergeWith:'205' },
  { id:'205',  name:'Auditorium 205',      floor:1, type:'Auditorium',      capacity:45, features:['Opens into 204'], bookable:true, mergeWith:'204' },
  { id:'209',  name:'Room 209',            floor:1, type:'Lecture Room',    capacity:40, features:[], bookable:true },
  { id:'210',  name:'Room 210',            floor:1, type:'Lecture Room',    capacity:32, features:[], bookable:true },
  { id:'213',  name:'Room 213',            floor:1, type:'Lecture Room',    capacity:50, features:[], bookable:true },
  { id:'214',  name:'Room 214',            floor:1, type:'Lecture Room',    capacity:45, features:[], bookable:true },
  { id:'215',  name:'Room 215',            floor:1, type:'Lecture Room',    capacity:36, features:[], bookable:true },
  { id:'216',  name:'PC Lab 216',          floor:1, type:'PC Lab',          capacity:32, features:[], bookable:true },
  // Faculty offices: staff only, never offered to students
  { id:'206',  name:'Faculty Office 206',  floor:1, type:'Faculty Office',  capacity:0,  features:[], bookable:false, restricted:true },
  { id:'207',  name:'Faculty Office 207',  floor:1, type:'Faculty Office',  capacity:0,  features:[], bookable:false, restricted:true },
  { id:'208',  name:'Faculty Office 208',  floor:1, type:'Faculty Office',  capacity:0,  features:[], bookable:false, restricted:true },
  { id:'211',  name:'Faculty Office 211',  floor:1, type:'Faculty Office',  capacity:0,  features:[], bookable:false, restricted:true },
  // Shared spaces (not bookable)
  { id:'DHL',  name:'DHL Library',         floor:1, type:'Library',         capacity:0,  features:[], bookable:false, publicSpace:true },
  { id:'CAFE', name:'Cafe (Open Space)',   floor:1, type:'Cafe',            capacity:0,  features:[], bookable:false, publicSpace:true },
];

// maintenance: set to true via admin to block a room
let ROOM_MAINTENANCE = {};

// Admin-set room status overrides (persisted in shared portal state)
// Values: 'free' | 'occ' | 'event' | 'booked' | 'maintenance'  — '' / absent = auto
let ROOM_STATUS_OVERRIDES = {};

// Room photos uploaded by admin: { roomId: [dataURL, ...] } (persisted in shared portal state)
let ROOM_PHOTOS = {};

// Rooms that can be opened into one big room (movable wall)
const MERGE_GROUPS = [['204','205']];

let SCHEDULE = [
  // Monday (day=1)
  {id:1,  day:1,start:'08:30',end:'10:30',roomId:'202',  course:'Business Fundamentals',         code:'BUS101',professor:'Prof. Sarah Mitchell',    program:'BA Business Administration',semester:'Fall 2026'},
  {id:2,  day:1,start:'10:30',end:'12:30',roomId:'213',  course:'Introduction to Marketing',     code:'MKT101',professor:'Dr. Khalid Al-Rashid',    program:'BA Business Administration',semester:'Fall 2026'},
  {id:3,  day:1,start:'11:00',end:'13:00',roomId:'209',  course:'Introduction to Programming',   code:'CS101', professor:'Dr. Elena Vasquez',       program:'BA Computer Science & AI',  semester:'Fall 2026'},
  {id:4,  day:1,start:'13:00',end:'14:00',roomId:'210',  course:'Academic Writing Workshop',     code:'GEN101',professor:'Dr. Lena Hoffmeister',    program:'All Programs',              semester:'Fall 2026'},
  {id:5,  day:1,start:'14:00',end:'16:00',roomId:'216', course:'Web Development Fundamentals',  code:'CS102', professor:'Dr. Elena Vasquez',       program:'BA Computer Science & AI',  semester:'Fall 2026'},
  {id:6,  day:1,start:'14:00',end:'16:00',roomId:'214',  course:'Financial Accounting',          code:'FIN101',professor:'Prof. Marcus Klein',      program:'BA Business Administration',semester:'Fall 2026'},
  {id:7,  day:1,start:'16:30',end:'18:30',roomId:'210',  course:'Strategic Management',          code:'MBA501',professor:'Prof. Dr. Anna Hoffmann', program:'MBA',                       semester:'Fall 2026'},
  {id:8,  day:1,start:'18:00',end:'19:30',roomId:'204',   course:'Guest Lecture: Dubai Ecosystem',code:'GEN001',professor:'Industry Speaker',        program:'All Programs',              semester:'Fall 2026'},
  // Tuesday (day=2)
  {id:9,  day:2,start:'09:00',end:'11:00',roomId:'202',  course:'Digital Media Production',      code:'DM101', professor:'Prof. Laura Chen',        program:'BA Digital Media',          semester:'Fall 2026'},
  {id:10, day:2,start:'09:00',end:'11:00',roomId:'209',  course:'Data Structures & Algorithms',  code:'CS201', professor:'Dr. Faisal Qureshi',      program:'BA Computer Science & AI',  semester:'Fall 2026'},
  {id:11, day:2,start:'11:00',end:'13:00',roomId:'216', course:'UX/UI Design Principles',       code:'DM201', professor:'Prof. Laura Chen',        program:'BA Digital Media',          semester:'Fall 2026'},
  {id:12, day:2,start:'11:00',end:'13:00',roomId:'213',  course:'Organizational Behavior',       code:'BUS201',professor:'Prof. Sarah Mitchell',    program:'BA Business Administration',semester:'Fall 2026'},
  {id:13, day:2,start:'13:30',end:'15:30',roomId:'210',  course:'Statistics for Business',       code:'QM101', professor:'Dr. Priya Patel',         program:'BA Business Administration',semester:'Fall 2026'},
  {id:14, day:2,start:'14:00',end:'16:00',roomId:'216', course:'Machine Learning Foundations',  code:'DS201', professor:'Dr. Priya Patel',         program:'MA Data Science',           semester:'Fall 2026'},
  {id:15, day:2,start:'16:00',end:'17:00',roomId:'210',  course:'Mentoring & Advising Session',  code:'GEN102',professor:'Academic Advisor',        program:'All Programs',              semester:'Fall 2026'},
  {id:16, day:2,start:'17:00',end:'19:00',roomId:'202',  course:'Digital Marketing Strategy',    code:'DM301', professor:'Dr. Khalid Al-Rashid',    program:'MA Digital Marketing',      semester:'Fall 2026'},
  // Wednesday (day=3)
  {id:17, day:3,start:'08:30',end:'10:30',roomId:'209',  course:'Entrepreneurship & Innovation', code:'BUS301',professor:'Prof. Dr. Anna Hoffmann', program:'BA Business Administration',semester:'Fall 2026'},
  {id:18, day:3,start:'09:00',end:'11:00',roomId:'216', course:'Database Management Systems',   code:'CS202', professor:'Dr. Faisal Qureshi',      program:'BA Computer Science & AI',  semester:'Fall 2026'},
  {id:19, day:3,start:'10:30',end:'12:30',roomId:'202',course:'Visual Communication Design',   code:'DM102', professor:'Prof. Laura Chen',        program:'BA Digital Media',          semester:'Fall 2026'},
  {id:20, day:3,start:'11:00',end:'13:00',roomId:'214',  course:'Corporate Finance',             code:'FIN201',professor:'Prof. Marcus Klein',      program:'BA Business Administration',semester:'Fall 2026'},
  {id:21, day:3,start:'13:00',end:'15:00',roomId:'215',  course:'Human Resource Management',     code:'HRM101',professor:'Prof. Sarah Mitchell',    program:'BA Business Administration',semester:'Fall 2026'},
  {id:22, day:3,start:'14:00',end:'16:00',roomId:'216', course:'AI & Neural Networks',          code:'CS301', professor:'Dr. Elena Vasquez',       program:'BA Computer Science & AI',  semester:'Fall 2026'},
  {id:23, day:3,start:'16:30',end:'18:30',roomId:'210',  course:'Business Analytics',            code:'MBA502',professor:'Dr. Priya Patel',         program:'MBA',                       semester:'Fall 2026'},
  {id:24, day:3,start:'18:00',end:'20:00',roomId:'209',  course:'Evening MBA: Finance Module',   code:'MBA510',professor:'Prof. Marcus Klein',      program:'MBA',                       semester:'Fall 2026'},
  // Thursday (day=4)
  {id:25, day:4,start:'09:00',end:'11:00',roomId:'202',  course:'Marketing Management',          code:'MKT201',professor:'Dr. Khalid Al-Rashid',    program:'BA Business Administration',semester:'Fall 2026'},
  {id:26, day:4,start:'09:00',end:'11:00',roomId:'216', course:'Data Analytics & Visualization',code:'DS301', professor:'Dr. Priya Patel',         program:'MA Data Science',           semester:'Fall 2026'},
  {id:27, day:4,start:'10:00',end:'12:00',roomId:'215',  course:'Social Media Marketing',        code:'DM202', professor:'Dr. Khalid Al-Rashid',    program:'MA Digital Marketing',      semester:'Fall 2026'},
  {id:28, day:4,start:'11:00',end:'13:00',roomId:'209',  course:'Software Engineering',          code:'CS203', professor:'Dr. Faisal Qureshi',      program:'BA Computer Science & AI',  semester:'Fall 2026'},
  {id:29, day:4,start:'13:30',end:'15:30',roomId:'216',course:'Motion Graphics & Animation',   code:'DM103', professor:'Prof. Laura Chen',        program:'BA Digital Media',          semester:'Fall 2026'},
  {id:30, day:4,start:'14:00',end:'16:00',roomId:'213',  course:'International Business',        code:'BUS302',professor:'Prof. Dr. Anna Hoffmann', program:'BA Business Administration',semester:'Fall 2026'},
  {id:31, day:4,start:'17:00',end:'19:00',roomId:'202',  course:'Leadership & Management',       code:'MBA503',professor:'Prof. Sarah Mitchell',    program:'MBA',                       semester:'Fall 2026'},
  {id:32, day:4,start:'17:00',end:'19:00',roomId:'204',   course:'Career Fair Prep Seminar',      code:'GEN003',professor:'Career Services Team',    program:'All Programs',              semester:'Fall 2026'},
  // Friday (day=5)
  {id:33, day:5,start:'09:00',end:'11:00',roomId:'216', course:'User Experience Design',        code:'DM204', professor:'Prof. Laura Chen',        program:'BA Digital Media',          semester:'Fall 2026'},
  {id:34, day:5,start:'09:00',end:'11:00',roomId:'214',  course:'Business Ethics & Law',         code:'BUS401',professor:'Prof. Dr. Anna Hoffmann', program:'BA Business Administration',semester:'Fall 2026'},
  {id:35, day:5,start:'10:00',end:'12:00',roomId:'209',  course:'Cloud Computing Fundamentals',  code:'CS302', professor:'Dr. Elena Vasquez',       program:'BA Computer Science & AI',  semester:'Fall 2026'},
  {id:36, day:5,start:'11:00',end:'13:00',roomId:'204',   course:'Weekly Innovation Forum',       code:'GEN002',professor:'Panel Discussion',        program:'All Programs',              semester:'Fall 2026'},
  {id:37, day:5,start:'13:00',end:'15:00',roomId:'216', course:'Natural Language Processing',   code:'DS302', professor:'Dr. Priya Patel',         program:'MA Data Science',           semester:'Fall 2026'},
  {id:38, day:5,start:'14:00',end:'16:00',roomId:'213',  course:'Digital Transformation MBA',    code:'MBA504',professor:'Dr. Faisal Qureshi',      program:'MBA',                       semester:'Fall 2026'},
  {id:39, day:5,start:'16:00',end:'17:30',roomId:'210',  course:'Student Research Presentations',code:'GEN104',professor:'Faculty Panel',           program:'All Programs',              semester:'Fall 2026'},
];

let ANNOUNCEMENTS = [
  {id:1, title:'Campus Closed – UAE National Day', msg:'The campus will be closed on 2–3 December for UAE National Day celebrations.', type:'info', created:'2026-11-10', expires:'2026-12-04'},
  {id:2, title:'Mid-term Exams Schedule', msg:'Mid-term exams run 18–22 November. Check your programme calendar for room assignments.', type:'warning', created:'2026-11-12', expires:'2026-11-23'},
];

// Professor substitutions set by admin (persisted):
// { id, absent:'Prof name', sub:'Prof name', from:'YYYY-MM-DD', to:'YYYY-MM-DD', entryIds:[...]|null, note }
let SUBSTITUTIONS = [];

let PROFESSORS = [
  {id:1, name:'Prof. Sarah Mitchell',    dept:'Business',   email:'s.mitchell@ue-dubai.ae',  phone:'+971 4 XXX 0001'},
  {id:2, name:'Dr. Khalid Al-Rashid',   dept:'Business',   email:'k.alrashid@ue-dubai.ae',  phone:'+971 4 XXX 0002'},
  {id:3, name:'Dr. Elena Vasquez',      dept:'Technology', email:'e.vasquez@ue-dubai.ae',   phone:'+971 4 XXX 0003'},
  {id:4, name:'Dr. Faisal Qureshi',     dept:'Technology', email:'f.qureshi@ue-dubai.ae',   phone:'+971 4 XXX 0004'},
  {id:5, name:'Dr. Priya Patel',        dept:'Data',       email:'p.patel@ue-dubai.ae',     phone:'+971 4 XXX 0005'},
  {id:6, name:'Prof. Laura Chen',       dept:'Design',     email:'l.chen@ue-dubai.ae',      phone:'+971 4 XXX 0006'},
  {id:7, name:'Prof. Marcus Klein',     dept:'Finance',    email:'m.klein@ue-dubai.ae',     phone:'+971 4 XXX 0007'},
  {id:8, name:'Prof. Dr. Anna Hoffmann',dept:'Business',   email:'a.hoffmann@ue-dubai.ae',  phone:'+971 4 XXX 0008'},
  {id:9, name:'Dr. Lena Hoffmeister',   dept:'General',    email:'l.hoffmeister@ue-dubai.ae',phone:'+971 4 XXX 0009'},
];

let PORTAL_SETTINGS = {
  semesterName: 'Fall Semester 2026',
  semesterStart: '2026-09-01',
  semesterEnd: '2026-12-20',
  campusName: 'UE Dubai Campus',
  campusAddress: 'One Central, Dubai World Trade Centre, Dubai, UAE',
  microsoftLogin: {
    enabled: true,
    domains: ['ue-germany.de'],
    defaultPermissions: ['chatbot'],
    defaultCapabilities: ['read_data', 'substitutes', 'capacity'],
  },
};

let _nextId = 40;
function nextId() { return _nextId++; }

// ─── Floor plan layout data ───────────────────────────
const FLOOR_LAYOUTS = {
  1: {
    w: 1000, h: 450,
    label: 'Ground Floor Plan · UE Dubai',
    struct: [
      ['outer', 0, 0, 1000, 450, null],
      ['corridor', 5, 205, 990, 50, 'Main Corridor'],
      ['util', 868, 205, 127, 50, 'Entrance'],
    ],
    rooms: [
      ['202', 10, 15, 230, 185],
      ['204', 243, 15, 130, 185],
      ['205', 376, 15, 130, 185],
      ['209', 509, 15, 120, 185],
      ['210', 632, 15, 115, 185],
      ['215', 750, 15, 115, 185],
      ['216', 868, 15, 122, 185],
      ['DHL', 10, 260, 210, 180],
      ['206', 223, 260, 100, 180],
      ['207', 326, 260, 100, 180],
      ['208', 429, 260, 100, 180],
      ['211', 532, 260, 100, 180],
      ['213', 635, 260, 115, 180],
      ['214', 753, 260, 115, 180],
      ['CAFE', 871, 260, 119, 180],
    ],
  },
};

// ─── Helpers (shared by index + admin) ───────────────
const t2m = t => { const [h,m]=t.split(':').map(Number); return h*60+m; };
const m2t = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const fmtT = t => { const [h,m]=t.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
const DAY_NAMES=['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAY_SHORT=['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ── Substitute professors ───────────────────────────────────────────
function ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
// Date (YYYY-MM-DD) of weekday `day` (1=Mon..5=Fri) in the current week
function weekDate(day){ const d=new Date(); d.setDate(d.getDate()-((d.getDay()+6)%7)+(day-1)); return ymd(d); }
// Substitution covering this class on this date, or null
function subFor(entry,date){
  date=date||weekDate(entry.day);
  return SUBSTITUTIONS.find(s=>s.absent===entry.professor && date>=s.from && date<=s.to && (!s.entryIds||s.entryIds.includes(entry.id)))||null;
}
// Name of whoever is actually teaching (substitute if one is assigned)
function effProf(entry,date){ const s=subFor(entry,date); return s?s.sub:entry.professor; }
function effProfHtml(entry,date){
  const s=subFor(entry,date); if(!s) return entry.professor;
  return `${s.sub} <span class="sub-badge" title="Covering for ${s.absent}">Substitute for ${s.absent}</span>`;
}
function getNow(){ const d=new Date(); return {jsDay:d.getDay(),min:d.getHours()*60+d.getMinutes()}; }
function getToday(){ const d=new Date().getDay(); return (d===0||d===6)?1:d; }
function getRoom(id){ return ROOMS.find(r=>r.id===id); }

function bookableRooms(){ return ROOMS.filter(r=>r.bookable!==false && !r.restricted && !r.publicSpace); }

function fmtDur(mins){
  mins=Math.max(0,Math.round(mins));
  const h=Math.floor(mins/60), m=mins%60;
  return h>0 ? (m? `${h}h ${m}m` : `${h}h`) : `${m} min`;
}
function roomStatus(roomId, day, curMin){
  const room=getRoom(roomId);
  if(room && room.restricted) return {status:'staff',entry:null};
  if(room && (room.publicSpace || room.bookable===false)) return {status:'public',entry:null};
  // Admin-set override takes priority over schedule (but not over staff/public)
  const ov=ROOM_STATUS_OVERRIDES[roomId];
  if(ov) return {status:ov, entry:null};
  if(ROOM_MAINTENANCE[roomId]) return {status:'maintenance',entry:null};
  const es=SCHEDULE.filter(s=>s.roomId===roomId&&s.day===day);
  const now=es.find(s=>t2m(s.start)<=curMin&&t2m(s.end)>curMin);
  if(now) return {status:'occ',entry:now};
  const soon=es.find(s=>t2m(s.start)>curMin&&t2m(s.start)-curMin<=15);
  if(soon) return {status:'soon',entry:soon};
  return {status:es.length>0?'free':'empty',entry:null};
}

function exportCSV(day){
  const rows=[['Time','Course','Code','Room','Professor','Program','Semester']];
  SCHEDULE.filter(s=>day?s.day===day:true).sort((a,b)=>a.day-b.day||t2m(a.start)-t2m(b.start)).forEach(s=>{
    rows.push([`${DAY_SHORT[s.day]} ${fmtT(s.start)}-${fmtT(s.end)}`,s.course,s.code,s.roomId,s.professor,s.program,s.semester||'']);
  });
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`ue-dubai-schedule${day?'-'+DAY_NAMES[day]:'full'}.csv`;
  a.click();
}

// ═══════════════════════════════════════════════════════════════════
// SHARED PERSISTENCE
// ═══════════════════════════════════════════════════════════════════
const _STORE_KEY = 'UE_PORTAL_v1'; // Legacy browser data imported on first admin login.
let _sharedUpdatedAt = null;

function getPortalState(){
  return {
    rm: ROOM_MAINTENANCE,
    ro: ROOM_STATUS_OVERRIDES,
    rp: ROOM_PHOTOS,
    rooms: ROOMS,
    sc: SCHEDULE,
    an: ANNOUNCEMENTS,
    pr: PROFESSORS,
    su: SUBSTITUTIONS,
    ps: PORTAL_SETTINGS,
    ni: _nextId,
  };
}

function applyPortalState(d){
  if(d.rm){Object.keys(ROOM_MAINTENANCE).forEach(k=>delete ROOM_MAINTENANCE[k]);Object.assign(ROOM_MAINTENANCE,d.rm);}
  if(d.ro){Object.keys(ROOM_STATUS_OVERRIDES).forEach(k=>delete ROOM_STATUS_OVERRIDES[k]);Object.assign(ROOM_STATUS_OVERRIDES,d.ro);}
  if(d.rp){Object.keys(ROOM_PHOTOS).forEach(k=>delete ROOM_PHOTOS[k]);Object.assign(ROOM_PHOTOS,d.rp);}
  if(Array.isArray(d.rooms)){ROOMS.length=0;ROOMS.push(...d.rooms);}
  if(Array.isArray(d.sc)){SCHEDULE.length=0;SCHEDULE.push(...d.sc);}
  if(Array.isArray(d.an)){ANNOUNCEMENTS.length=0;ANNOUNCEMENTS.push(...d.an);}
  if(Array.isArray(d.su)){SUBSTITUTIONS.length=0;SUBSTITUTIONS.push(...d.su);}
  if(Array.isArray(d.pr)){PROFESSORS.length=0;PROFESSORS.push(...d.pr);}
  if(d.ps)Object.assign(PORTAL_SETTINGS,d.ps);
  if(Number.isInteger(d.ni))_nextId=d.ni;
}

async function saveAll(section){
  const response=await fetch(`/api/state?section=${encodeURIComponent(section)}`,{
    method:'PUT',
    credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(getPortalState()),
  });
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||`Could not sync changes (${response.status})`);
  return true;
}

async function loadAll(force){
  const query=!force&&_sharedUpdatedAt?`?since=${encodeURIComponent(_sharedUpdatedAt)}`:'';
  const response=await fetch(`/api/state${query}`,{credentials:'same-origin'});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||`Could not load shared data (${response.status})`);
  if(result.notModified)return {found:true,legacy:false,notModified:true,updatedAt:_sharedUpdatedAt};
  if(result.state){
    applyPortalState(result.state);
    _sharedUpdatedAt=result.updatedAt||null;
    return {found:true,legacy:false,updatedAt:_sharedUpdatedAt};
  }
  _sharedUpdatedAt=null;
  const raw=localStorage.getItem(_STORE_KEY);
  if(raw){
    const legacy=JSON.parse(raw);
    applyPortalState(legacy);
    return {found:false,legacy:true};
  }
  return {found:false,legacy:false};
}
