import React, { useState } from 'react';
import { ReportHeader } from '../components/print/ReportHeader';
import HousekeepingHub from './pages/HousekeepingHub';

const HousekeepingHub = () => {
  const [rooms, setRooms] = useState([{ id: 101, status: 'Clean' }]);

  const updateStatus = (id, newStatus) => {
    setRooms(rooms.map(room => room.id === id ? { ...room, status: newStatus } : room));
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Housekeeping Hub</h2>
      {rooms.map(room => (
        <div key={room.id} className="border p-4 mb-2">
          <p>Room {room.id} - Status: {room.status}</p>
          <button onClick={() => updateStatus(room.id, 'Clean')} className="bg-green-500 text-white mr-2">Clean</button>
          <button onClick={() => updateStatus(room.id, 'Dirty')} className="bg-red-500 text-white">Dirty</button>
        </div>
      ))}
    </div>
  );
};
export default HousekeepingHub;
