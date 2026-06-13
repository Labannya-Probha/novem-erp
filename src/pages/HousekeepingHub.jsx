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
            <div className="mt-2">
  <label className="text-xs text-gray-500">Change Status:</label>
  <select 
    value={room.status} 
    onChange={(e) => updateStatus(room.id, e.target.value)}
    className="block w-full mt-1 p-2 border rounded-md text-sm"
  >
    <option value="Clean">Clean</option>
    <option value="Dirty">Dirty</option>
    <option value="Occupied">Occupied</option>
    <option value="Out of Service">Out of Service</option>
  </select>
</div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default HousekeepingHub;
