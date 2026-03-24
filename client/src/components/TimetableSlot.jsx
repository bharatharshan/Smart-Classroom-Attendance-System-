import React, { useState, useEffect } from 'react';
import { classrooms as classroomsApi } from '../api';
import { CLASS_OPTIONS, SUBJECT_OPTIONS } from '../constants';

/**
 * Single slot in the timetable grid: subject, class name, room dropdown.
 * When room is selected, fetches and displays latitude, longitude as read-only.
 * If roomList is passed from parent, uses it; otherwise fetches once per slot.
 */
export function TimetableSlot({ slot, onChange, roomList: roomListProp }) {
  const [roomCoordinates, setRoomCoordinates] = useState(null);
  const [roomListLocal, setRoomListLocal] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(!roomListProp);

  const roomList = roomListProp !== undefined && Array.isArray(roomListProp) ? roomListProp : roomListLocal;

  useEffect(() => {
    if (roomListProp !== undefined) return;
    setRoomsLoading(true);
    classroomsApi
      .list()
      .then((list) => setRoomListLocal(Array.isArray(list) ? list : []))
      .catch(() => setRoomListLocal([]))
      .finally(() => setRoomsLoading(false));
  }, [roomListProp]);

  useEffect(() => {
    if (!slot?.room_id) {
      setRoomCoordinates(null);
      return;
    }
    const id = typeof slot.room_id === 'string' ? slot.room_id : slot.room_id;
    classroomsApi.getCoordinates(id).then(setRoomCoordinates).catch(() => setRoomCoordinates(null));
  }, [slot?.room_id]);

  const handleRoomChange = (e) => {
    const roomId = e.target.value || null;
    // Derive a human-friendly room label so View Timetable can display it
    let roomLabelValue = '';
    if (roomId && Array.isArray(roomList)) {
      const match = roomList.find((r) => roomIdForOption(r) === roomId);
      if (match) {
        roomLabelValue = match.room_name || match.room_id || '';
      }
    }
    onChange({ ...slot, room_id: roomId, room: roomLabelValue });
  };

  const roomIdForOption = (r) => (r.id != null ? String(r.id) : r.room_id);
  const roomLabel = (r) => {
    const name = r.room_name || r.room_id || '';
    if (!name) return 'Room';
    return /^room\s+/i.test(String(name).trim()) ? name : `Room ${name}`;
  };

  return (
    <div className="timetable-slot">
      <label className="timetable-slot__label">Subject</label>
      <select
        className="timetable-slot__select"
        value={slot?.subject || ''}
        onChange={(e) => onChange({ ...slot, subject: e.target.value || '' })}
      >
        <option value="">Select subject</option>
        {SUBJECT_OPTIONS.map((s) => (
          <option key={s.id} value={`${s.id} - ${s.name}`}>
            {s.id} - {s.name}
          </option>
        ))}
      </select>
      <label className="timetable-slot__label">Class</label>
      <select
        className="timetable-slot__select"
        value={slot?.class_name || ''}
        onChange={(e) => onChange({ ...slot, class_name: e.target.value || '' })}
      >
        <option value="">Select class</option>
        {CLASS_OPTIONS.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <label className="timetable-slot__label">Room</label>
      <select
        className="timetable-slot__select"
        value={slot?.room_id != null ? String(slot.room_id) : ''}
        onChange={handleRoomChange}
        disabled={roomsLoading}
      >
        <option value="">
          {roomsLoading ? 'Loading rooms...' : roomList.length === 0 ? 'No rooms available' : 'Select room'}
        </option>
        {roomList.map((r) => (
          <option key={roomIdForOption(r)} value={roomIdForOption(r)}>
            {roomLabel(r)}
          </option>
        ))}
      </select>
      {roomCoordinates && (
        <div className="timetable-slot__coords">
          <div>Latitude: <strong>{roomCoordinates.latitude}</strong></div>
          <div>Longitude: <strong>{roomCoordinates.longitude}</strong></div>
          <div>Radius: <strong>{roomCoordinates.allowed_radius}m</strong></div>
        </div>
      )}
    </div>
  );
}
