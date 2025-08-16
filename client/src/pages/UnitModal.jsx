import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { deleteUnitById, updateUnit } from "@/services/inventoryService";
import { toast } from "sonner";

export default function UnitModal({ isOpen, onClose, selectedItem, onUnitDeleted }) {
  const [units, setUnits] = useState(selectedItem?.units || []);

  useEffect(() => {
    setUnits(selectedItem?.units || []);
  }, [selectedItem]);

  const handleDownload = async (qrUrl, itemName, unitIndex, size) => {
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error(`Failed to fetch QR image: ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const formattedItemName = (itemName || "item").replace(/\s+/g, "_");
      const formattedSize = size ? `_${size.replace(/\s+/g, "_")}` : "";
      const filename = `${formattedItemName}_unit_${unitIndex + 1}${formattedSize}.png`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("❌ Error downloading QR code:", error);
      toast.error("Failed to download QR code. Check if the image file exists on the server.");
    }
  };

  const handlePrint = (qrUrl) => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`<img src="${qrUrl}" onload="window.print(); window.close();" />`);
    printWindow.document.close();
  };

  const handleDelete = async (unitId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this unit?");
    if (!confirmDelete) return;
    try {
      await deleteUnitById(unitId);
      toast.success("Unit deleted");
      onUnitDeleted?.();
      setUnits(units.filter((u) => u.id !== unitId));
    } catch (error) {
      console.error("❌ Failed to delete unit", error);
      toast.error("Failed to delete unit");
    }
  };

  const handleEdit = async (unit) => {
    const newSize = prompt("Enter new size", unit.size || "");
    if (!newSize || newSize.trim() === "" || newSize === unit.size) return;
    try {
      const updated = await updateUnit(unit.id, { size: newSize });
      const refreshed = units.map((u) => (u.id === unit.id ? updated : u));
      setUnits(refreshed);
      toast.success("Unit size updated");
    } catch (error) {
      console.error("❌ Failed to update unit", error);
      toast.error("Failed to update unit");
    }
  };

  const hasSizes = units.some((u) => !!u.size);

  // ✅ Correct ordering: small → medium → large → others
  const sizeOrder = ["SMALL", "MEDIUM", "LARGE"];
  const sortedUnits = [...units].sort((a, b) => {
    const aIndex = sizeOrder.indexOf(a.size?.toUpperCase()) !== -1
      ? sizeOrder.indexOf(a.size?.toUpperCase())
      : sizeOrder.length;
    const bIndex = sizeOrder.indexOf(b.size?.toUpperCase()) !== -1
      ? sizeOrder.indexOf(b.size?.toUpperCase())
      : sizeOrder.length;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.id.localeCompare(b.id); // fallback tie-breaker
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <button className="sr-only" autoFocus tabIndex={0}>
          Focus trap anchor
        </button>

        <DialogHeader>
          <DialogTitle>{selectedItem?.name || "Inventory Units"}</DialogTitle>
        </DialogHeader>

        <div className="text-center text-sm text-gray-500 mt-1">
          {hasSizes
            ? Object.entries(
                units.reduce((acc, unit) => {
                  acc[unit.size] = (acc[unit.size] || 0) + 1;
                  return acc;
                }, {})
              )
                .map(([size, count]) => `${count} ${size}`)
                .join(", ")
            : `${units.length} unit${units.length !== 1 ? "s" : ""}`}
        </div>

        {selectedItem?.item_name && (
          <div className="text-center font-semibold text-lg text-gray-800 mt-2">
            {selectedItem.item_name}
          </div>
        )}

        <ScrollArea className="max-h-[70vh] mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
            {(() => {
              const sizeCounters = {};
              return sortedUnits.map((unit, index) => {
                const size = unit.size || "unit";
                sizeCounters[size] = (sizeCounters[size] || 0) + 1;
                const sizeLabel = hasSizes
                  ? `${size} — #${sizeCounters[size]}`
                  : `Unit #${index + 1}`;

                return (
                  <div
                    key={unit.id}
                    className="border p-4 rounded-xl shadow-md flex flex-col items-center gap-2 bg-white"
                  >
                    <p className="text-sm font-medium">{sizeLabel}</p>
                    <p className="text-xs text-gray-500 break-all">Unit ID: {unit.id}</p>
                    <img
                      src={unit.qr_code_url}
                      alt={`QR Code ${index + 1}`}
                      width={100}
                      height={100}
                      className="border rounded"
                      onError={(e) => {
                        e.target.src = "/placeholder.png";
                      }}
                    />
                    <div className="flex gap-2 flex-wrap justify-center">
                      <Button
                        onClick={() =>
                          handleDownload(unit.qr_code_url, selectedItem.name, index, unit.size)
                        }
                        size="sm"
                      >
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handlePrint(unit.qr_code_url)}
                        size="sm"
                      >
                        Print
                      </Button>
                      {hasSizes && (
                        <Button
                          variant="secondary"
                          onClick={() => handleEdit(unit)}
                          size="sm"
                        >
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(unit.id)}
                        size="sm"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}