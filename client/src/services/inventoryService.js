// inventoryService.js
import axios from "axios";

// Delete a specific unit
export const deleteUnitById = async (unitId) => {
  const res = await axios.delete(`/api/inventory/units/${unitId}`);
  return res.data;
};

// Update a specific unit
export const updateUnit = async (unitId, data) => {
  const res = await axios.put(`/api/inventory/units/${unitId}`, data);
  return res.data;
};

// Reserve a costume unit (mark as borrowed/reserved)
export const reserveCostumeUnit = async (unitId) => {
  const res = await axios.post(`/api/inventory/units/${unitId}/reserve`);
  return res.data;
};

// Release a costume unit (mark as available again)
export const releaseCostumeUnit = async (unitId) => {
  const res = await axios.post(`/api/inventory/units/${unitId}/release`);
  return res.data;
};
