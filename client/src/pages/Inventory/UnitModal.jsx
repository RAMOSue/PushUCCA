import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { deleteUnitById } from "@/services/inventoryService";
import { toast } from "sonner";
import { Download, Printer, Trash2, CheckSquare, Square, Search, X } from "lucide-react";

export default function UnitModal({ isOpen, onClose, selectedItem, onUnitDeleted }) {
  const [units, setUnits] = useState(selectedItem?.units || []);
  const [selectedUnits, setSelectedUnits] = useState(new Set());
  const [filterSize, setFilterSize] = useState("all");
  const [searchQuery, setSearchQuery] = useState(""); // ✅ NEW: Search state
  const [persistedItem, setPersistedItem] = useState(null);

  useEffect(() => {
    // Load persisted state from localStorage on mount
    const saved = localStorage.getItem("unitModalState");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPersistedItem(parsed);
      } catch (err) {
        console.error("Error loading persisted state:", err);
      }
    }
  }, []);

  useEffect(() => {
    setUnits(selectedItem?.units || []);
    setSelectedUnits(new Set());
    setFilterSize("all");
    setSearchQuery(""); // ✅ Clear search on item change

    // Persist the selected item to localStorage
    if (selectedItem) {
      localStorage.setItem(
        "unitModalState",
        JSON.stringify({
          id: selectedItem.id,
          name: selectedItem.name,
          category: selectedItem.category,
        })
      );
      setPersistedItem(selectedItem);
    }
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

      toast.success("QR code downloaded successfully");
    } catch (error) {
      console.error("❌ Error downloading QR code:", error);
      toast.error("Failed to download QR code");
    }
  };

  const handleBatchDownload = async () => {
    if (selectedUnits.size === 0) {
      toast.error("Please select at least one unit");
      return;
    }

    try {
      for (const unitId of selectedUnits) {
        const unit = units.find((u) => u.id === unitId);
        if (unit) {
          const index = units.indexOf(unit);
          await handleDownload(unit.qr_code_url, selectedItem.name, index, unit.size);
        }
      }
      toast.success(`Downloaded ${selectedUnits.size} QR code${selectedUnits.size > 1 ? "s" : ""}`);
      setSelectedUnits(new Set());
    } catch (error) {
      console.error("❌ Error in batch download:", error);
      toast.error("Error downloading QR codes");
    }
  };

  const handlePrintSelected = async () => {
    if (selectedUnits.size === 0) {
      toast.error("Please select at least one unit");
      return;
    }

    try {
      // Get the selected units in order
      const unitsToPrint = filteredUnits.filter((u) => selectedUnits.has(u.id));

      // Convert all images to base64 first
      const unitsWithBase64 = await Promise.all(
        unitsToPrint.map(async (unit) => {
          try {
            const response = await fetch(unit.qr_code_url);
            const blob = await response.blob();
            const reader = new FileReader();
            return new Promise((resolve) => {
              reader.onloadend = () => {
                resolve({
                  ...unit,
                  base64: reader.result,
                });
              };
              reader.readAsDataURL(blob);
            });
          } catch (err) {
            console.error("Error loading QR code:", err);
            return { ...unit, base64: null };
          }
        })
      );

      // Create a new window for printing
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>QR Code Print - ${selectedItem.name}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            @page {
              size: 8.5in 11in;
              margin: 0.5in;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: white;
              padding: 0.5in;
            }
            @media print {
              body {
                padding: 0.5in;
              }
            }
            .print-container {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 0.3in;
              width: 100%;
            }
            .qr-item {
              border: 1px solid #ddd;
              padding: 0.15in;
              text-align: center;
              page-break-inside: avoid;
              background: white;
              break-inside: avoid;
            }
            .qr-label {
              font-size: 14px;
              font-weight: 700;
              color: #222;
              margin-bottom: 0.15in;
            }
            .qr-image-wrapper {
              width: 100%;
              height: 1.8in;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #f5f5f5;
              border: 1px solid #eee;
              border-radius: 4px;
            }
            .qr-image {
              max-width: 1.8in;
              max-height: 1.8in;
              object-fit: contain;
            }
            .item-name {
              font-size: 10px;
              color: #666;
              margin-top: 0.05in;
              word-break: break-word;
            }
            .header {
              text-align: center;
              margin-bottom: 0.2in;
              border-bottom: 2px solid #333;
              padding-bottom: 0.1in;
            }
            .header h2 {
              font-size: 16px;
              margin: 0;
              color: #333;
            }
            .header p {
              font-size: 11px;
              color: #666;
              margin: 0.05in 0 0 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${selectedItem.name}</h2>
            <p>QR Codes - Printed: ${new Date().toLocaleDateString()}</p>
          </div>
          <div className="print-container">
            ${unitsWithBase64
              .map((unit) => {
                // ✅ Use unit_number from database - sticky to this UUID
                const label = unit.unit_number || `Unit ${unit.id.slice(0, 8)}`;
                
                return `
                  <div class="qr-item">
                    <div class="qr-label">${label}</div>
                    <div class="qr-image-wrapper">
                      ${
                        unit.base64
                          ? `<img src="${unit.base64}" alt="QR Code" class="qr-image" />`
                          : `<span style="color: #999; font-size: 10px;">QR Error</span>`
                      }
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
          <script>
            setTimeout(() => {
              window.print();
              setTimeout(() => window.close(), 500);
            }, 500);
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();

      toast.success(`Printing ${selectedUnits.size} QR code${selectedUnits.size > 1 ? "s" : ""}`);
    } catch (error) {
      console.error("❌ Error printing QR codes:", error);
      toast.error("Error printing QR codes");
    }
  };

  const handleDelete = async (unitId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this unit?");
    if (!confirmDelete) return;
    try {
      await deleteUnitById(unitId);
      toast.success("Unit deleted successfully");
      onUnitDeleted?.();
      setUnits(units.filter((u) => u.id !== unitId));
    } catch (error) {
      console.error("❌ Failed to delete unit", error);
      toast.error("Failed to delete unit");
    }
  };

  const hasSizes = units.some((u) => !!u.size && u.size !== "nosize");

  // ✅ Sort units: small → medium → large → others, then by unit_number numeric value
  const sizeOrder = ["SMALL", "MEDIUM", "LARGE"];

  // ✅ Helper function to extract numeric part from unit_number for proper sorting
  const extractNumFromUnitNumber = (unitNumber) => {
    if (!unitNumber) return 0;
    // Extract the last number from formats like "Suyam-S-1", "Suyam-M-10", etc.
    const matches = unitNumber.match(/(\d+)$/);
    return matches ? parseInt(matches[1], 10) : 0;
  };

  const sortedUnits = [...units].sort((a, b) => {
    // First sort by size order (Small → Medium → Large → nosize)
    const aIndex = sizeOrder.indexOf(a.size?.toUpperCase()) !== -1
      ? sizeOrder.indexOf(a.size?.toUpperCase())
      : sizeOrder.length;
    const bIndex = sizeOrder.indexOf(b.size?.toUpperCase()) !== -1
      ? sizeOrder.indexOf(b.size?.toUpperCase())
      : sizeOrder.length;

    if (aIndex !== bIndex) return aIndex - bIndex;

    // Then sort by numeric part of unit_number (1, 2, 3, ... 10, 11, etc.)
    const aNum = extractNumFromUnitNumber(a.unit_number);
    const bNum = extractNumFromUnitNumber(b.unit_number);
    if (aNum !== bNum) return aNum - bNum;

    // Final fallback: sort by unit_number string (for items with same number but different names)
    const aLabel = a.unit_number || `Unit ${a.id.slice(0, 8)}`;
    const bLabel = b.unit_number || `Unit ${b.id.slice(0, 8)}`;
    return aLabel.localeCompare(bLabel);
  });

  // Get unique sizes (exclude nosize)
  const uniqueSizes = [...new Set(sortedUnits.map((u) => (u.size && u.size !== "nosize") ? u.size : null).filter(Boolean))].sort();

  // Filter units by size AND search query
  const filteredUnits = sortedUnits.filter((u) => {
    // Size filter
    if (filterSize !== "all" && (u.size || "Standard") !== filterSize) {
      return false;
    }
    
    // Search filter - search by unit_number (sticky database label)
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      // Search in unit_number (always available)
      const unitLabel = u.unit_number || `Unit ${u.id.slice(0, 8)}`;
      return unitLabel.toLowerCase().includes(searchLower);
    }
    
    return true;
  });

  // Toggle unit selection
  const toggleUnitSelection = (unitId) => {
    const newSelected = new Set(selectedUnits);
    if (newSelected.has(unitId)) {
      newSelected.delete(unitId);
    } else {
      newSelected.add(unitId);
    }
    setSelectedUnits(newSelected);
  };

  // Select all filtered units
  const selectAllFiltered = () => {
    const allIds = new Set(filteredUnits.map((u) => u.id));
    setSelectedUnits(allIds);
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedUnits(new Set());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <button className="sr-only" autoFocus tabIndex={0}>
          Focus trap anchor
        </button>

        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {selectedItem?.name || "Inventory Units"}
          </DialogTitle>
        </DialogHeader>

        {/* Summary Info */}
        <div className="bg-gradient-to-r from-blue-50 to-slate-50 rounded-lg p-4 border border-slate-200 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Units</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{units.length} unit{units.length !== 1 ? "s" : ""}</p>
            </div>
            {hasSizes && (
              <div className="text-right">
                <p className="text-sm font-medium text-slate-600">Breakdown</p>
                <p className="text-sm text-slate-700 mt-1">
                  {Object.entries(
                    units.reduce((acc, unit) => {
                      acc[unit.size] = (acc[unit.size] || 0) + 1;
                      return acc;
                    }, {})
                  )
                    .map(([size, count]) => `${count} ${size}`)
                    .join(" • ")}
                </p>
              </div>
            )}
          </div>

          {selectedUnits.size > 0 && (
            <div className="border-t border-slate-300 pt-3 text-sm">
              <p className="text-slate-600">
                <span className="font-semibold text-slate-900">{selectedUnits.size}</span> selected
              </p>
            </div>
          )}
        </div>

        {/* Filter & Search & Actions */}
        <div className="space-y-3 mb-4">
          {/* Search Bar */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 hover:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder='Search unit names (e.g., "Suyam S - 1")'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 text-sm outline-none bg-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>
          </div>

          {/* Size Filter and Actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Filter by Size:</label>
              <select
                value={filterSize}
                onChange={(e) => setFilterSize(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Sizes</option>
                {uniqueSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {selectedUnits.size > 0 && (
                <>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={handleBatchDownload}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download {selectedUnits.size}
                  </button>
                  <button
                    onClick={handlePrintSelected}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 text-xs font-medium transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print {selectedUnits.size}
                  </button>
                </>
              )}
              {selectedUnits.size !== filteredUnits.length && (
                <button
                  onClick={selectAllFiltered}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  Select All
                </button>
              )}
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredUnits.map((unit) => {
              // ✅ CRITICAL: ALWAYS use unit_number from database - NO dynamic generation
              // Each UUID has exactly ONE unit_number that persists in the database
              // Format: "ItemName-Size-Number" (e.g., "Suyam-S-1")
              const displayLabel = unit.unit_number || `Unit-${unit.id.slice(0, 8)}`;
              const isSelected = selectedUnits.has(unit.id);

              return (
                <div
                  key={unit.id}
                  className={`border-2 rounded-lg bg-white overflow-hidden flex flex-col transition-all ${
                    isSelected 
                      ? "border-blue-500 shadow-lg ring-2 ring-blue-200" 
                      : "border-slate-200 hover:shadow-md"
                  }`}
                >
                  {/* Header with Checkbox */}
                  <div className="bg-gradient-to-r from-blue-50 to-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900 truncate">{displayLabel}</p>
                    <button
                      onClick={() => toggleUnitSelection(unit.id)}
                      className="p-1 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
                      title={isSelected ? "Deselect" : "Select"}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  </div>

                  {/* QR Code Section */}
                  <div className="p-4 flex flex-col items-center">
                    {/* QR Label - Sticky to this UUID - Database-bound label */}
                    <p className="text-base md:text-lg font-bold text-slate-900 mb-3 text-center">
                      🏷️ {displayLabel}
                    </p>
                      
                      {/* QR Code Image */}
                      <img
                        src={unit.qr_code_url}
                        alt={`QR Code - ${displayLabel}`}
                        width={120}
                        height={120}
                        className="border-2 border-slate-200 rounded-lg bg-white"
                        onError={(e) => {
                          e.target.src = "/placeholder.png";
                        }}
                      />
                    </div>

                    {/* Actions */}
                    <div className="px-4 py-3 border-t border-slate-200 flex gap-2 justify-center flex-wrap">
                      <button
                        onClick={() =>
                          handleDownload(unit.qr_code_url, selectedItem.name, unit.id, unit.size)
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-medium transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      <button
                        onClick={() => handleDelete(unit.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-xs font-medium transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
            })}
          </div>
          {filteredUnits.length === 0 && (
            <div className="flex items-center justify-center h-40">
              <p className="text-slate-500 text-sm">No units found with selected size</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}