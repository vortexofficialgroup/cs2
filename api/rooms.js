// api/rooms.js — GET /api/rooms
const handler = require('../lib/http');
const { requireSession } = require('../lib/auth');
const store   = require('../lib/store');

module.exports = handler({
  GET(req, res) {
    if (!requireSession(req, res)) return;
    const rooms = store.getRooms();
    // Attach current status based on server time
    const now  = new Date();
    const day  = now.getDay(); // 0=Sun..6=Sat; treat weekend as no classes
    const mins = now.getHours() * 60 + now.getMinutes();
    const t2m  = t => { const [h,m]=t.split(':').map(Number); return h*60+m; };

    const enriched = rooms.map(room => {
      const schedule = store.getSchedule(day === 0 || day === 6 ? -1 : day)
        .filter(s => s.roomId === room.id);

      const current = schedule.find(s => t2m(s.start) <= mins && t2m(s.end) > mins);
      const soon    = schedule.find(s => t2m(s.start) > mins && t2m(s.start) - mins <= 15);
      const status  = current ? 'occupied' : soon ? 'starting_soon' : 'free';

      return { ...room, status, currentClass: current || null, nextClass: soon || null };
    });

    res.json({ rooms: enriched });
  },
});
