import { useEffect, useState } from "react";
import { deleteUnitById } from "@/services/inventoryService";
import { toast } from "sonner";
import { Download, Printer, Trash2, CheckSquare, Square, Search, X, ChevronLeft } from "lucide-react";

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
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30 transition-opacity duration-300 animate-in fade-in"
          onClick={onClose}
        />
      )}

      {/* Right Side Panel */}
      {isOpen && (
        <div className="fixed right-0 top-0 h-screen w-[500px] bg-surface-container-lowest dark:bg-[#1a1a1a] border-l border-outline-variant/20 dark:border-gray-700 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] dark:shadow-[-10px_0_30px_rgba(0,0,0,0.4)] z-40 overflow-hidden flex flex-col transition-all duration-300 ease-out animate-in slide-in-from-right-full">
          {/* Header */}
          <div className="px-8 py-6 border-b border-outline-variant/20 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-on-surface dark:text-white">
                {selectedItem?.name || "Inventory Units"}
              </h2>
              <p className="text-xs text-on-surface-variant dark:text-gray-400 mt-1 uppercase tracking-wide font-medium">{units.length} unit{units.length !== 1 ? "s" : ""}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-container-high dark:hover:bg-[#222] rounded transition-colors"
              title="Close"
            >
              <ChevronLeft className="w-5 h-5 text-on-surface dark:text-white" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Summary Info */}
            <div className="bg-primary/10 dark:bg-blue-900/30 rounded-lg p-4 border border-primary/20 dark:border-blue-900/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-on-surface-variant dark:text-gray-400 uppercase">Total Units</p>
                  <p className="text-lg font-semibold text-on-surface dark:text-white mt-1">{units.length}</p>
                </div>
                {hasSizes && (
                  <div className="text-right text-xs">
                    <p className="font-medium text-on-surface-variant dark:text-gray-400 uppercase">Breakdown</p>
                    <p className="text-sm text-on-surface dark:text-white mt-1">
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
                <div className="border-t border-primary/30 dark:border-blue-900/50 pt-3 mt-3 text-xs">
                  <p className="text-on-surface dark:text-white">
                    <span className="font-semibold">{selectedUnits.size}</span> selected
                  </p>
                </div>
              )}
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-2 bg-surface-container-low dark:bg-[#222] rounded-lg px-3 py-2.5 border border-outline-variant/20 dark:border-gray-700 hover:border-primary/20 dark:hover:border-blue-600 focus-within:ring-2 focus-within:ring-primary transition">
              <Search className="w-4 h-4 text-on-surface-variant dark:text-gray-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search units..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent focus:outline-none text-sm text-on-surface dark:text-white dark:placeholder-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="p-1 hover:bg-surface-container-high dark:hover:bg-[#333] rounded transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4 text-on-surface-variant dark:text-gray-500" />
                </button>
              )}
            </div>

            {/* Two Column Control Section */}
            <div className="grid grid-cols-2 gap-3">
              {/* LEFT: Actions */}
              <div className="space-y-2">
                {selectedUnits.size > 0 && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={deselectAll}
                      className="flex-1 px-2 py-2 rounded text-xs font-medium border border-outline-variant/20 dark:border-gray-700 text-on-surface dark:text-white hover:bg-surface-container-high dark:hover:bg-[#222] transition"
                      title="Deselect All"
                    >
                      Deselect
                    </button>
                    <button
                      onClick={handleBatchDownload}
                      className="p-2 rounded bg-primary/10 dark:bg-blue-900/30 text-primary dark:text-blue-400 hover:bg-primary/20 dark:hover:bg-blue-900/50 transition"
                      title={`Download ${selectedUnits.size} QR code${selectedUnits.size > 1 ? "s" : ""}`}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handlePrintSelected}
                      className="p-2 rounded bg-green-600/20 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-600/30 dark:hover:bg-green-900/50 transition"
                      title={`Print ${selectedUnits.size} QR code${selectedUnits.size > 1 ? "s" : ""}`}
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {selectedUnits.size !== filteredUnits.length && (
                  <button
                    onClick={selectAllFiltered}
                    className="w-full px-2 py-2 rounded text-xs font-medium border border-primary/30 dark:border-blue-900/50 text-primary dark:text-blue-400 bg-primary/10 dark:bg-blue-900/20 hover:bg-primary/20 dark:hover:bg-blue-900/40 transition"
                  >
                    Select All ({filteredUnits.length})
                  </button>
                )}
              </div>

              {/* RIGHT: Filter */}
              <div className="flex items-start gap-2">
                <label className="text-xs font-semibold text-on-surface dark:text-white uppercase whitespace-nowrap pt-2">Filter:</label>
                <select
                  value={filterSize}
                  onChange={(e) => setFilterSize(e.target.value)}
                  className="flex-1 bg-surface-container-low dark:bg-[#222] border border-outline-variant/20 dark:border-gray-700 rounded-lg px-2 py-2 text-xs text-on-surface dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="all">All Sizes</option>
                  {uniqueSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Units Grid */}
            <div className="grid grid-cols-2 gap-3">
              {filteredUnits.length === 0 ? (
                <div className="col-span-2 flex items-center justify-center py-12">
                  <p className="text-xs text-on-surface-variant dark:text-gray-400">No units found</p>
                </div>
              ) : (
                filteredUnits.map((unit) => {
                  const displayLabel = unit.unit_number || `Unit-${unit.id.slice(0, 8)}`;
                  const isSelected = selectedUnits.has(unit.id);

                  return (
                    <div
                      key={unit.id}
                      className={`border rounded-lg overflow-hidden bg-surface-container-high dark:bg-[#222] transition-all ${
                        isSelected 
                          ? "border-primary/50 dark:border-blue-600/50 ring-2 ring-primary/20 dark:ring-blue-600/20" 
                          : "border-outline-variant/20 dark:border-gray-700 hover:border-outline-variant/40 dark:hover:border-gray-600"
                      }`}
                    >
                      {/* Header with Checkbox */}
                      <div className="px-3 py-2.5 border-b border-outline-variant/20 dark:border-gray-700 flex items-center justify-between bg-surface-container-low dark:bg-[#1a1a1a]">
                        <p className="text-xs font-semibold text-on-surface dark:text-white truncate">{displayLabel}</p>
                        <button
                          onClick={() => toggleUnitSelection(unit.id)}
                          className="p-1 hover:bg-surface-container-high dark:hover:bg-[#333] rounded transition-colors flex-shrink-0"
                          title={isSelected ? "Deselect" : "Select"}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary dark:text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4 text-on-surface-variant dark:text-gray-600" />
                          )}
                        </button>
                      </div>

                      {/* QR Code Display */}
                      <div className="p-3 flex flex-col items-center space-y-2">
                        <img
                          src={unit.qr_code_url}
                          alt={`QR Code - ${displayLabel}`}
                          width={100}
                          height={100}
                          className="border border-outline-variant/20 dark:border-gray-700 rounded-lg bg-surface-container-lowest dark:bg-[#0a0a0a]"
                          onError={(e) => {
                            e.target.src = "/placeholder.png";
                          }}
                        />
                        {unit.size && unit.size !== "nosize" && (
                          <span className="text-[9px] text-on-surface-variant dark:text-gray-400 uppercase font-medium px-2 py-0.5 bg-surface-container-lowest dark:bg-[#0a0a0a] rounded">
                            {unit.size}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="px-3 py-2 border-t border-outline-variant/20 dark:border-gray-700 flex gap-1.5 justify-center">
                        <button
                          onClick={() =>
                            handleDownload(unit.qr_code_url, selectedItem.name, filteredUnits.indexOf(unit), unit.size)
                          }
                          className="p-2 rounded bg-primary/10 dark:bg-blue-900/30 text-primary dark:text-blue-400 hover:bg-primary/20 dark:hover:bg-blue-900/50 transition"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(unit.id)}
                          className="p-2 rounded bg-error/10 dark:bg-red-900/30 text-error dark:text-red-400 hover:bg-error/20 dark:hover:bg-red-900/50 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}