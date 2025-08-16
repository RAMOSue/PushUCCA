// inventoryService.js
import axios from "axios";

export const deleteUnitById = async (unitId) => {
  const res = await axios.delete(`/api/inventory/units/${unitId}`);
  return res.data;
};

export const updateUnit = async (unitId, data) => {
  const res = await axios.put(`/api/inventory/units/${unitId}`, data);
  return res.data;
};
