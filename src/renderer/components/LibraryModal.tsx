import React, { useState } from 'react';
import { X, Search, Check, Image as ImageIcon } from 'lucide-react';
import { LibraryImage } from '@shared/types';
import { getImageLibrary } from '../lib/storage';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUrl: (url: string) => void;
  title?: string;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectUrl,
  title = 'Choose from Image Library',
}) => {
  const images = getImageLibrary();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  if (!isOpen) return null;

  const categories = [
    'All',
    'Hero Images',
    'Campaign Banners',
    'Desktop Images',
    'Mobile Images',
    'Logos',
    'Icons',
    'Backgrounds',
    'Popups',
    'Buttons',
    'Other',
  ];

  const filtered = images.filter(img => {
    const matchesSearch =
      img.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (img.externalUrl && img.externalUrl.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'All' || img.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0e1426] border border-[#1e2942] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2942] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-300 flex items-center justify-center border border-violet-500/30">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[11px] text-gray-400">Select a reusable asset for replacement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2030] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-[#1e2942] flex flex-wrap gap-3 items-center justify-between bg-[#121829]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search library images..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2563eb]"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-md py-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#2563eb] text-white'
                    : 'bg-[#0a0e1a] text-gray-400 hover:text-white border border-[#1e2942]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Image Grid */}
        <div className="flex-1 p-6 overflow-y-auto grid grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-3 text-center py-12 text-gray-400 text-xs">
              No images match your filter in the library.
            </div>
          ) : (
            filtered.map(img => {
              const displayUrl = img.externalUrl || img.dataUrl || '';
              return (
                <div
                  key={img.id}
                  onClick={() => {
                    if (displayUrl) {
                      onSelectUrl(displayUrl);
                      onClose();
                    }
                  }}
                  className="group relative bg-[#121829] border border-[#1e2942] hover:border-[#2563eb] rounded-xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col"
                >
                  <div className="h-32 bg-[#0a0e1a] flex items-center justify-center overflow-hidden p-2">
                    {displayUrl ? (
                      <img
                        src={displayUrl}
                        alt={img.name}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-600" />
                    )}
                  </div>
                  <div className="p-3 border-t border-[#1e2942] flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white truncate" title={img.name}>
                        {img.name}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{img.category}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                      <span>{(img.fileSize / 1024).toFixed(0)} KB</span>
                      <button className="px-2 py-0.5 rounded bg-violet-600/20 text-violet-300 group-hover:bg-[#2563eb] group-hover:text-white transition-colors flex items-center gap-1 font-sans font-medium text-[10px]">
                        <Check className="w-2.5 h-2.5" /> Select
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
