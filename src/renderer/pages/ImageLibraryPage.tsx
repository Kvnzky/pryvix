import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Search,
  Trash2,
  Copy,
  ExternalLink,
  AlertTriangle,
  Check,
  Globe,
  HardDrive,
  Filter,
} from 'lucide-react';
import { LibraryImage } from '@shared/types';
import { getImageLibrary, addImageToLibrary, deleteImageFromLibrary } from '../lib/storage';

export const ImageLibraryPage: React.FC = () => {
  const [images, setImages] = useState<LibraryImage[]>(getImageLibrary());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showAddUrlModal, setShowAddUrlModal] = useState(false);
  const [newUrlName, setNewUrlName] = useState('');
  const [newUrlCategory, setNewUrlCategory] = useState<LibraryImage['category']>('Hero Images');
  const [newUrlInput, setNewUrlInput] = useState('');

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

  const refreshList = () => {
    setImages(getImageLibrary());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      const cleanName = file.name.replace(/\.[^/.]+$/, '');

      // Estimate category based on name
      let cat: LibraryImage['category'] = 'Other';
      if (/hero/i.test(cleanName)) cat = 'Hero Images';
      else if (/banner/i.test(cleanName)) cat = 'Campaign Banners';
      else if (/desktop/i.test(cleanName)) cat = 'Desktop Images';
      else if (/mobile/i.test(cleanName)) cat = 'Mobile Images';
      else if (/logo/i.test(cleanName)) cat = 'Logos';
      else if (/icon/i.test(cleanName)) cat = 'Icons';
      else if (/popup/i.test(cleanName)) cat = 'Popups';

      addImageToLibrary({
        name: cleanName,
        category: cat,
        localPath: file.name,
        dataUrl,
        mimeType: file.type || 'image/png',
        fileSize: file.size,
      });

      refreshList();
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAddExternalUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrlInput.trim()) return;

    addImageToLibrary({
      name: newUrlName.trim() || 'CDN Asset',
      category: newUrlCategory,
      localPath: '',
      externalUrl: newUrlInput.trim(),
      mimeType: 'image/jpeg',
      fileSize: 150000,
    });

    setNewUrlInput('');
    setNewUrlName('');
    setShowAddUrlModal(false);
    refreshList();
  };

  const handleDelete = (id: string) => {
    deleteImageFromLibrary(id);
    refreshList();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredImages = images.filter(img => {
    const matchesSearch =
      img.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (img.externalUrl && img.externalUrl.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'All' || img.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Top Banner Warning regarding GoHighLevel CDN Hosting requirement */}
      <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-600/30 flex items-start gap-3.5">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200">
          <div className="font-bold text-amber-300">GoHighLevel Public Asset Hosting Notice</div>
          <p className="mt-0.5 text-amber-300/80 leading-relaxed">
            Local computer files cannot be directly displayed inside GoHighLevel landing pages when exported. For production campaigns, ensure image assets have publicly accessible HTTPS URLs (such as GoHighLevel CDN or AWS S3) before exporting HTML.
          </p>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">Image Library</h2>
            <p className="text-xs text-gray-400">
              Reusable assets across multiple landing page campaigns ({images.length} items)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-[#121829] border border-[#1e2942] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <button
            onClick={() => setShowAddUrlModal(true)}
            className="px-3.5 py-2 rounded-xl bg-[#121829] hover:bg-[#18223a] border border-[#1e2942] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" /> Add Hosted URL
          </button>

          <label className="cursor-pointer px-4 py-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#7c3aed] hover:from-[#1d4ed8] hover:to-[#6d28d9] text-white text-xs font-semibold shadow-md shadow-blue-950/40 flex items-center gap-1.5 transition-all">
            <Upload className="w-3.5 h-3.5" /> Upload Image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <Filter className="w-3.5 h-3.5 text-gray-400 mr-1 flex-shrink-0" />
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-[#2563eb] text-white font-semibold'
                : 'bg-[#121829] text-gray-400 hover:text-white border border-[#1e2942]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Images Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {filteredImages.map(img => {
          const displayUrl = img.externalUrl || img.dataUrl || '';
          const isExternal = Boolean(img.externalUrl);

          return (
            <div
              key={img.id}
              className="bg-[#111520] border border-[#1f2638] hover:border-[#2f3b55] rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg transition-all duration-200 group"
            >
              {/* Image Preview Box */}
              <div className="relative h-44 bg-[#090a0f] p-3 flex items-center justify-center overflow-hidden border-b border-[#1f2638]">
                {displayUrl ? (
                  <img
                    src={displayUrl}
                    alt={img.name}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <ImageIcon className="w-12 h-12 text-gray-600" />
                )}

                <div className="absolute top-2 left-2">
                  {isExternal ? (
                    <span className="flex items-center gap-1 text-[9px] font-mono bg-blue-950/80 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded-full">
                      <Globe className="w-2.5 h-2.5" /> HTTPS CDN
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[9px] font-mono bg-amber-950/80 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded-full">
                      <HardDrive className="w-2.5 h-2.5" /> Local File
                    </span>
                  )}
                </div>

                <div className="absolute top-2 right-2">
                  <button
                    onClick={() => handleDelete(img.id)}
                    className="p-1 rounded bg-black/70 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card Meta */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-white tracking-wide truncate" title={img.name}>
                      {img.name}
                    </h4>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{img.category}</div>

                  {img.externalUrl && (
                    <div className="text-[10px] font-mono text-gray-400 mt-2 truncate bg-[#090a0f] p-1.5 rounded border border-[#1a2030]" title={img.externalUrl}>
                      {img.externalUrl}
                    </div>
                  )}
                </div>

                {/* Footer Copy Action */}
                <div className="mt-4 pt-3 border-t border-[#1a2030] flex items-center justify-between text-[11px] text-gray-400 font-mono">
                  <span>{(img.fileSize / 1024).toFixed(0)} KB</span>

                  <button
                    onClick={() => copyToClipboard(displayUrl, img.id)}
                    className="px-2.5 py-1 rounded bg-[#161c2b] hover:bg-[#202b40] text-gray-300 hover:text-white text-[10px] font-medium flex items-center gap-1 transition-colors border border-[#222b3f]"
                  >
                    {copiedId === img.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy URL
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add External URL Modal */}
      {showAddUrlModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1117] border border-[#222b3f] rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1">Register Hosted Asset URL</h3>
            <p className="text-xs text-gray-400 mb-4">
              Add a publicly accessible CDN or HTTPS image link to your reusable library.
            </p>
            <form onSubmit={handleAddExternalUrl} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Asset Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hero Desktop Red Graphic"
                  value={newUrlName}
                  onChange={e => setNewUrlName(e.target.value)}
                  className="w-full bg-[#131722] border border-[#222b3f] rounded-lg px-3 py-1.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={newUrlCategory}
                  onChange={e => setNewUrlCategory(e.target.value as any)}
                  className="w-full bg-[#131722] border border-[#222b3f] rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  {categories.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  HTTPS Image URL *
                </label>
                <input
                  type="url"
                  placeholder="https://assets.cdn.filesafe.space/..."
                  value={newUrlInput}
                  onChange={e => setNewUrlInput(e.target.value)}
                  className="w-full bg-[#131722] border border-[#222b3f] rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1f2638]">
                <button
                  type="button"
                  onClick={() => setShowAddUrlModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#151a27] text-gray-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-semibold"
                >
                  Add to Library
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
