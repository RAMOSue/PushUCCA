// src/services/inventoryService.js

export const addInventoryItem = async (itemData) => {
  const res = await fetch("/api/inventory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(itemData),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to add inventory item");
  }

  return res.json(); // should return the created item + units
};

export const getUnitsByItemId = async (itemId) => {
  const res = await fetch(`/api/inventory/${itemId}/units`);
  if (!res.ok) {
    throw new Error("Failed to fetch item units");
  }
  return res.json();
};
