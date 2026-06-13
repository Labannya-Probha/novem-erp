import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { ReportHeader } from '../components/print/ReportHeader';

const HousekeepingHub = () => {
  const [rooms, setRooms] = useState([]);

  const loadRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('room_no');
    setRooms(data || []);
  };

  useEffect(() => { loadRooms(); }, []);

  const updateStatus = async (id, newStatus) => {
    await supabase.from('rooms').update({ status: newStatus }).eq('id', id);
    loadRooms(); // Data refresh kora
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-5">Housekeeping Hub</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rooms.map(room => (
          <div key={room.id} className="card p-4 shadow">
            <h3>Room: {room.room_no}</h3>
            <p>Status: <b>{room.status}</b></p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => updateStatus(room.id, 'Clean')} className="btn-primary py-1 px-3 text-xs">Clean</button>
              <button onClick={() => updateStatus(room.id, 'Dirty')} className="btn-ghost py-1 px-3 text-xs">Dirty</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default HousekeepingHub;
