import React, { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { 
  Plus, Search, ClipboardList, Edit, Trash2, User as UserIcon, Briefcase, History, 
  LayoutDashboard, Package, ShoppingCart, Users, Truck, LogOut, Menu, Barcode,
  BarChart, Download, X, Check, AlertTriangle, Save, RefreshCw, ChevronDown, ChevronUp, Printer, FileText, ExternalLink, Camera, Video
} from 'lucide-react';
import { 
  User, Product, Supplier, StockMovement, PurchaseOrder, Sale, AppState, SecurityAction, SaleItem
} from './types';
import { getAppState, saveAppState } from './services/storage';
import { generateInventoryAnalysis } from './services/geminiService';
import { formatDate, formatCurrency, CATEGORIES, UNITS } from './constants';
import { BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// --- Context & Types ---

interface AppContextType {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  logSecurityAction: (action: SecurityAction, description: string, overrideUser?: string) => void;
  logout: () => void;
  playSound: (type: 'beep' | 'error' | 'success') => void;
  navigateTo: (view: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};

// --- Helper Functions ---

const playSound = (type: 'beep' | 'error' | 'success') => {
    // In a real app, this would play audio files.
    // For now we just log, but the structure is here.
    console.log(`🔊 Playing sound: ${type}`);
};

// --- Helper Components ---

const Button = ({ children, variant = 'primary', className = '', ...props }: any) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
    outline: "border-2 border-gray-300 text-gray-700 hover:border-gray-400 bg-transparent",
    success: "bg-green-600 text-white hover:bg-green-700 shadow-sm"
  };
  return (
    <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Modal = ({ isOpen, onClose, title, children, size = 'md' }: { isOpen: boolean; onClose: () => void; title: string | ReactNode; children?: ReactNode, size?: 'sm'|'md'|'lg'|'xl' }) => {
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${sizes[size]} p-6 max-h-[90vh] overflow-y-auto flex flex-col`}>
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {children}
        </div>
      </div>
    </div>
  );
};

const PinModal = ({ isOpen, onClose, onSuccess, title, description }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; title: string, description?: string }) => {
  const [pin, setPin] = useState('');
  const { state, notify, playSound } = useAppContext();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      if (isOpen) {
          setPin('');
          setTimeout(() => inputRef.current?.focus(), 100);
      }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === state.adminPin) {
      playSound('success');
      onSuccess();
      setPin('');
      onClose();
    } else {
      playSound('error');
      notify("PIN incorreto. Acesso negado.", "error");
      setPin('');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <form onSubmit={handleSubmit} className="space-y-6 text-center">
        <div className="bg-red-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
            <AlertTriangle className="text-red-500" size={32} />
        </div>
        <div>
            <p className="text-gray-600 font-medium">{description || "Esta ação requer autorização de gerente."}</p>
            <p className="text-sm text-gray-400 mt-1">Entre com o PIN administrativo</p>
        </div>
        <input
          ref={inputRef}
          type="password"
          value={pin}
          onChange={e => setPin(e.target.value)}
          placeholder="••••"
          className="w-full border-2 border-gray-200 rounded-xl p-4 text-center text-3xl tracking-[1em] focus:border-blue-500 outline-none transition-all"
          maxLength={4}
        />
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="danger">Autorizar</Button>
        </div>
      </form>
    </Modal>
  );
};

const CameraScanner = ({ onScan, onClose }: { onScan: (code: string) => void, onClose: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string>('');
    const [lastCode, setLastCode] = useState<string>('');
    const [lastTime, setLastTime] = useState(0);

    useEffect(() => {
        let stream: MediaStream | null = null;
        let interval: any = null;

        const startCamera = async () => {
            try {
                // Prefer rear camera
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    
                    // Wait for metadata to ensure video is ready
                    await new Promise((resolve) => {
                         if (!videoRef.current) return resolve(false);
                         videoRef.current.onloadedmetadata = () => {
                            videoRef.current?.play();
                            resolve(true);
                         };
                    });
                    
                    // Use BarcodeDetector if available (Chrome/Android)
                    if ('BarcodeDetector' in window) {
                         const BarcodeDetector = (window as any).BarcodeDetector;
                         const detector = new BarcodeDetector({ formats: ['ean_13', 'code_128', 'qr_code', 'upc_a'] });
                         
                         interval = setInterval(async () => {
                             if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
                                 try {
                                     const barcodes = await detector.detect(videoRef.current);
                                     if (barcodes.length > 0) {
                                         const raw = barcodes[0].rawValue;
                                         // Debounce: Prevent reading the same code instantly
                                         const now = Date.now();
                                         // If it's a new code or 2 seconds passed since last read
                                         if (raw !== lastCode || (now - lastTime > 2000)) {
                                             onScan(raw);
                                             setLastCode(raw);
                                             setLastTime(now);
                                         }
                                     }
                                 } catch (err) {
                                     // Detection error (ignore frame)
                                 }
                             }
                         }, 200);
                    } else {
                        setError("Navegador sem suporte a leitura nativa. Use o botão de simulação.");
                    }
                }
            } catch (err) {
                console.error(err);
                setError("Acesso à câmera negado ou indisponível.");
            }
        };

        startCamera();

        return () => {
            if (interval) clearInterval(interval);
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [onScan, lastCode, lastTime]);

    // Update debounce state in effect (a bit tricky in strict mode, simplify using refs in production)
    useEffect(() => {
        setLastCode('');
        setLastTime(0);
    }, []);

    return (
        <div className="fixed inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center p-4 animate-fade-in">
             <div className="w-full max-w-md bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 relative shadow-2xl">
                <div className="absolute top-4 left-4 z-10 bg-black/50 px-3 py-1 rounded-full text-white text-xs font-mono">
                    REC ●
                </div>
                <button onClick={onClose} className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-colors">
                    <X size={20} />
                </button>
                
                <div className="relative aspect-[4/3] bg-black">
                    <video ref={videoRef} className="w-full h-full object-cover" />
                    {!error && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-64 h-40 border-2 border-green-500/50 rounded-lg relative">
                                <div className="absolute inset-0 border-t-2 border-green-400 animate-scan"></div>
                                <div className="absolute bottom-2 left-0 w-full text-center text-green-400 text-xs font-mono">
                                    APONTE PARA O CÓDIGO
                                </div>
                            </div>
                        </div>
                    )}
                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-white p-6 text-center">
                            <AlertTriangle className="text-yellow-500 mb-2" size={32} />
                            <p className="text-sm font-medium mb-4">{error}</p>
                            <p className="text-xs text-gray-400">Em um dispositivo real compatível, a câmera abriria aqui.</p>
                        </div>
                    )}
                </div>
                
                <div className="p-6 bg-gray-800 border-t border-gray-700">
                     <p className="text-center text-gray-400 text-sm mb-4">
                        Caso a câmera não leia, digite o código manualmente ou use o simulador.
                     </p>
                     <Button variant="secondary" onClick={() => onScan('7891234567890')} className="w-full">
                        <Barcode size={16} /> Simular Leitura (Teste)
                     </Button>
                </div>
             </div>
        </div>
    );
};

// --- Components ---

const BarcodeScannerMock = ({ onScan }: { onScan: (code: string) => void }) => {
    const [code, setCode] = useState('');

    const handleSimulate = (e: React.FormEvent) => {
        e.preventDefault();
        if(code) {
            onScan(code);
            setCode('');
        }
    };

    return (
        <div className="bg-gray-900 text-white p-4 rounded-lg mb-4">
            <p className="text-xs text-gray-400 mb-2 font-mono uppercase tracking-wider">Simulador de Scanner USB</p>
            <form onSubmit={handleSimulate} className="flex gap-2">
                <input 
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="Digite ou cole um EAN..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono"
                />
                <button type="submit" className="bg-blue-600 px-3 py-2 rounded text-sm hover:bg-blue-500">
                    OK
                </button>
            </form>
        </div>
    );
};

const Products = () => {
  const { state, updateState, notify, logSecurityAction } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const isAdmin = state.currentUser?.role === 'admin';

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const isEditing = !!editingProduct;
    const id = isEditing ? editingProduct.id : Date.now().toString();

    const product: Product = {
      id,
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      sku: formData.get('sku') as string,
      barcode: formData.get('barcode') as string,
      qty: isEditing ? editingProduct.qty : Number(formData.get('qty')), // Qty managed by movements
      minQty: Number(formData.get('minQty')),
      costPrice: Number(formData.get('costPrice')),
      sellPrice: Number(formData.get('sellPrice')),
      unit: formData.get('unit') as string,
      supplierId: formData.get('supplierId') as string,
      imageUrl: formData.get('imageUrl') as string || undefined,
    };

    let updatedProducts = [...state.products];
    if (isEditing) {
      updatedProducts = updatedProducts.map(p => p.id === id ? product : p);
      notify("Produto atualizado!", "success");
    } else {
      updatedProducts.push(product);
      if (product.qty > 0) {
        const movement: StockMovement = {
            id: Date.now().toString(),
            productId: product.id,
            type: 'in',
            qty: product.qty,
            date: new Date().toISOString(),
            userId: state.currentUser?.id || 'sys',
            userName: state.currentUser?.name || 'Sistema',
            observation: 'Estoque inicial'
        };
        updateState({ products: updatedProducts, movements: [...state.movements, movement] });
        setIsModalOpen(false);
        setEditingProduct(null);
        return;
      }
      notify("Produto cadastrado!", "success");
    }

    updateState({ products: updatedProducts });
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const initiateDelete = (id: string) => {
    setPendingDeleteId(id);
    setPinModalOpen(true);
  };

  const confirmDelete = () => {
      if (pendingDeleteId) {
          const p = state.products.find(prod => prod.id === pendingDeleteId);
          updateState({ products: state.products.filter(prod => prod.id !== pendingDeleteId) });
          logSecurityAction('delete_product', `Produto excluído: ${p?.name}`);
          notify("Produto removido.", "info");
          setPendingDeleteId(null);
      }
  };

  const filteredProducts = state.products.filter(p => 
    (selectedCategory === '' || p.category === selectedCategory) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.barcode.includes(searchTerm) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in">
       <PinModal isOpen={pinModalOpen} onClose={() => setPinModalOpen(false)} onSuccess={confirmDelete} title="Excluir Produto" />
       
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Catálogo de Produtos</h1>
            <p className="text-gray-500 text-sm">Gerencie preços, códigos e fornecedores.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>
            <Plus size={20} /> Novo Produto
          </Button>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <input 
                type="text" 
                placeholder="Buscar por nome, código de barras ou SKU..." 
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-3.5 text-gray-400" size={20} /> 
          </div>
          <select 
            className="p-3 border rounded-lg bg-white min-w-[200px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
              <option value="">Todas as Categorias</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-600 border-b">
                    <tr>
                        <th className="p-4">Produto</th>
                        <th className="p-4 text-center">Categoria</th>
                        <th className="p-4 text-center">Estoque</th>
                        <th className="p-4 text-right">Preço</th>
                        <th className="p-4 text-right">Margem</th>
                        <th className="p-4 text-center">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y text-sm">
                    {filteredProducts.map(p => {
                        const isZeroStock = p.qty === 0;
                        const isLowStock = p.qty <= p.minQty;
                        const margin = ((p.sellPrice - p.costPrice) / p.sellPrice) * 100;
                        
                        let rowClass = "hover:bg-gray-50 transition-colors border-l-4 border-transparent";
                        if (isZeroStock) {
                            rowClass = "bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500";
                        } else if (isLowStock) {
                            rowClass = "bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-400";
                        }

                        return (
                            <tr key={p.id} className={rowClass}>
                                <td className="p-4">
                                    <div className="font-bold text-gray-800 flex items-center gap-2">
                                        {p.name}
                                        {isZeroStock && <AlertTriangle size={16} className="text-red-600" title="Estoque Zerado" />}
                                        {!isZeroStock && isLowStock && <AlertTriangle size={16} className="text-orange-500" title="Estoque Baixo" />}
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{p.barcode || 'SEM EAN'}</span>
                                        <span className="text-gray-400">|</span>
                                        <span>SKU: {p.sku}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                                        {p.category}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    <div className={`inline-flex flex-col items-center px-3 py-1 rounded-lg ${
                                        isZeroStock ? 'bg-red-100 text-red-700 font-bold' :
                                        isLowStock ? 'bg-orange-100 text-orange-700' :
                                        'bg-green-100 text-green-700'
                                    }`}>
                                        <span className="font-bold">{p.qty}</span>
                                        <span className="text-[10px] uppercase">{p.unit}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="font-bold text-gray-800">{formatCurrency(p.sellPrice)}</div>
                                    <div className="text-xs text-gray-400">Custo: {formatCurrency(p.costPrice)}</div>
                                </td>
                                <td className="p-4 text-right">
                                    <span className={`text-xs font-bold ${margin < 20 ? 'text-red-500' : 'text-green-600'}`}>
                                        {margin.toFixed(0)}%
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    {isAdmin && (
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Editar">
                                                <Edit size={18} />
                                            </button>
                                            <button onClick={() => initiateDelete(p.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Excluir">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {filteredProducts.length === 0 && (
                <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                    <Search size={48} className="mb-4 opacity-20" />
                    <p>Nenhum produto encontrado com os filtros atuais.</p>
                </div>
            )}
        </div>
      </div>

      <Modal 
         isOpen={isModalOpen} 
         onClose={() => setIsModalOpen(false)} 
         title={editingProduct ? "Editar Produto" : "Novo Produto"}
         size="lg"
      >
        <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                    <input name="name" defaultValue={editingProduct?.name} required className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Arroz Branco Tipo 1" />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras (EAN)</label>
                    <div className="flex gap-2">
                        <input name="barcode" defaultValue={editingProduct?.barcode} className="w-full border rounded-lg p-3 font-mono" placeholder="789..." />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código Interno (SKU)</label>
                    <input name="sku" defaultValue={editingProduct?.sku} required className="w-full border rounded-lg p-3 font-mono" placeholder="PROD-001" />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <select name="category" defaultValue={editingProduct?.category} className="w-full border rounded-lg p-3 bg-white">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unidade de Medida</label>
                    <select name="unit" defaultValue={editingProduct?.unit} className="w-full border rounded-lg p-3 bg-white">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>
                
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor Principal</label>
                    <select name="supplierId" defaultValue={editingProduct?.supplierId} className="w-full border rounded-lg p-3 bg-white">
                        <option value="">Selecione...</option>
                        {state.suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                {!editingProduct && (
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Inicial</label>
                        <input type="number" name="qty" defaultValue={0} min="0" className="w-full border rounded-lg p-3" />
                    </div>
                )}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Precificação e Alertas</h3>
                <div className="grid grid-cols-3 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Preço de Custo</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-gray-400">R$</span>
                            <input type="number" step="0.01" name="costPrice" defaultValue={editingProduct?.costPrice} required className="w-full border rounded-lg p-3 pl-9" placeholder="0.00" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Preço de Venda</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-gray-400">R$</span>
                            <input type="number" step="0.01" name="sellPrice" defaultValue={editingProduct?.sellPrice} required className="w-full border rounded-lg p-3 pl-9" placeholder="0.00" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Estoque Mínimo</label>
                        <input type="number" name="minQty" defaultValue={editingProduct?.minQty} required className="w-full border rounded-lg p-3" />
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL da Imagem (Opcional)</label>
                <input name="imageUrl" defaultValue={editingProduct?.imageUrl} className="w-full border rounded-lg p-3" placeholder="https://..." />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={(e: any) => { e.preventDefault(); setIsModalOpen(false); }}>Cancelar</Button>
                <Button type="submit">Salvar Produto</Button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

// --- Purchases Component ---

const Purchases = () => {
    const { state, updateState, notify, logSecurityAction } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);
    const [newOrderSupplierId, setNewOrderSupplierId] = useState('');
    const [newOrderItems, setNewOrderItems] = useState<{productId: string, qty: number, cost: number}[]>([]);
    
    // Form temporary state
    const [selectedProduct, setSelectedProduct] = useState('');
    const [itemQty, setItemQty] = useState(1);
    const [itemCost, setItemCost] = useState(0);

    const handleAddItem = () => {
        if (!selectedProduct || itemQty <= 0 || itemCost < 0) return;
        setNewOrderItems([...newOrderItems, { productId: selectedProduct, qty: itemQty, cost: itemCost }]);
        setSelectedProduct('');
        setItemQty(1);
        setItemCost(0);
    };

    const handleRemoveItem = (index: number) => {
        const items = [...newOrderItems];
        items.splice(index, 1);
        setNewOrderItems(items);
    };

    const handleSaveOrder = () => {
        if (!newOrderSupplierId || newOrderItems.length === 0) {
            notify("Selecione um fornecedor e adicione itens.", "error");
            return;
        }

        const newOrder: PurchaseOrder = {
            id: Date.now().toString(),
            supplierId: newOrderSupplierId,
            status: 'open',
            dateCreated: new Date().toISOString(),
            items: newOrderItems
        };

        updateState({ orders: [newOrder, ...state.orders] });
        notify("Pedido de compra criado com sucesso.", "success");
        setIsModalOpen(false);
        resetForm();
    };

    const resetForm = () => {
        setNewOrderSupplierId('');
        setNewOrderItems([]);
        setSelectedProduct('');
        setItemQty(1);
        setItemCost(0);
        setViewingOrder(null);
    };

    const handleUpdateStatus = (orderId: string, newStatus: 'open' | 'sent' | 'received') => {
        const order = state.orders.find(o => o.id === orderId);
        if (!order) return;

        if (newStatus === 'received' && order.status !== 'received') {
            // Process stock update
            const updatedProducts = [...state.products];
            const newMovements = [...state.movements];
            
            order.items.forEach(item => {
                const productIndex = updatedProducts.findIndex(p => p.id === item.productId);
                if (productIndex > -1) {
                    const product = updatedProducts[productIndex];
                    // Calculate Weighted Average Cost
                    const currentTotalValue = product.qty * product.costPrice;
                    const newItemsValue = item.qty * item.cost;
                    const newTotalQty = product.qty + item.qty;
                    const newAvgCost = (currentTotalValue + newItemsValue) / newTotalQty;

                    updatedProducts[productIndex] = {
                        ...product,
                        qty: newTotalQty,
                        costPrice: Number(newAvgCost.toFixed(2))
                    };

                    newMovements.push({
                        id: Date.now().toString() + item.productId,
                        productId: item.productId,
                        type: 'in',
                        qty: item.qty,
                        date: new Date().toISOString(),
                        userId: state.currentUser?.id || 'sys',
                        userName: state.currentUser?.name || 'Sistema',
                        observation: `Pedido de Compra #${order.id}`
                    });
                }
            });

            const updatedOrders = state.orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
            updateState({ 
                orders: updatedOrders,
                products: updatedProducts,
                movements: newMovements
            });
            notify(`Pedido #${orderId} recebido! Estoque atualizado.`, "success");
            logSecurityAction('manual_adjustment', `Recebimento de Pedido #${orderId}`);
        } else {
             const updatedOrders = state.orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
             updateState({ orders: updatedOrders });
             notify(`Status do pedido atualizado para ${newStatus}.`, "success");
        }
        setViewingOrder(null);
    };

    const getOrderTotal = (items: any[]) => items.reduce((acc, item) => acc + (item.qty * item.cost), 0);

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Compras e Pedidos</h1>
                    <p className="text-gray-500 text-sm">Gerencie aquisições e entrada de mercadorias.</p>
                </div>
                <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
                    <Plus size={20} /> Novo Pedido
                </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                 <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-600 border-b">
                        <tr>
                            <th className="p-4">Data</th>
                            <th className="p-4">Fornecedor</th>
                            <th className="p-4 text-center">Itens</th>
                            <th className="p-4 text-right">Valor Total</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                        {state.orders.map(order => {
                            const supplier = state.suppliers.find(s => s.id === order.supplierId);
                            return (
                                <tr key={order.id} className="hover:bg-gray-50">
                                    <td className="p-4 text-gray-600">{formatDate(order.dateCreated)}</td>
                                    <td className="p-4 font-medium text-gray-800">{supplier?.name || 'Desconhecido'}</td>
                                    <td className="p-4 text-center">{order.items.length}</td>
                                    <td className="p-4 text-right font-bold">{formatCurrency(getOrderTotal(order.items))}</td>
                                    <td className="p-4 text-center">
                                         <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                                            order.status === 'received' ? 'bg-green-100 text-green-700' :
                                            order.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {order.status === 'received' ? 'Recebido' : order.status === 'sent' ? 'Enviado' : 'Aberto'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => setViewingOrder(order)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg">
                                            <FileText size={18} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                 </table>
            </div>

            {/* Create Order Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Pedido de Compra" size="lg">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                        <select 
                            className="w-full border rounded-lg p-3 bg-white"
                            value={newOrderSupplierId}
                            onChange={(e) => setNewOrderSupplierId(e.target.value)}
                        >
                            <option value="">Selecione um fornecedor...</option>
                            {state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-gray-700 mb-3 text-sm">Adicionar Produtos</h4>
                        <div className="flex gap-2 mb-2">
                             <select 
                                className="flex-1 border rounded-lg p-2 text-sm"
                                value={selectedProduct}
                                onChange={(e) => {
                                    setSelectedProduct(e.target.value);
                                    const prod = state.products.find(p => p.id === e.target.value);
                                    if(prod) setItemCost(prod.costPrice);
                                }}
                            >
                                <option value="">Produto...</option>
                                {state.products.filter(p => !newOrderSupplierId || p.supplierId === newOrderSupplierId || !p.supplierId).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <input 
                                type="number" min="1" placeholder="Qtd" 
                                className="w-20 border rounded-lg p-2 text-sm"
                                value={itemQty} onChange={e => setItemQty(Number(e.target.value))}
                            />
                            <input 
                                type="number" step="0.01" placeholder="Custo" 
                                className="w-24 border rounded-lg p-2 text-sm"
                                value={itemCost} onChange={e => setItemCost(Number(e.target.value))}
                            />
                            <Button onClick={handleAddItem} className="px-3"><Plus size={16}/></Button>
                        </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-2">Produto</th>
                                    <th className="p-2 text-center">Qtd</th>
                                    <th className="p-2 text-right">Custo Unit.</th>
                                    <th className="p-2 text-right">Subtotal</th>
                                    <th className="p-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {newOrderItems.map((item, idx) => {
                                    const prod = state.products.find(p => p.id === item.productId);
                                    return (
                                        <tr key={idx} className="border-t">
                                            <td className="p-2">{prod?.name}</td>
                                            <td className="p-2 text-center">{item.qty}</td>
                                            <td className="p-2 text-right">{formatCurrency(item.cost)}</td>
                                            <td className="p-2 text-right">{formatCurrency(item.qty * item.cost)}</td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => handleRemoveItem(idx)} className="text-red-500"><Trash2 size={14}/></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {newOrderItems.length === 0 && <p className="text-center text-gray-400 py-4 text-sm">Nenhum item adicionado.</p>}
                    </div>
                     
                     <div className="flex justify-between items-center pt-4 border-t">
                        <div className="text-lg font-bold text-gray-800">Total: {formatCurrency(getOrderTotal(newOrderItems))}</div>
                        <div className="flex gap-2">
                             <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                             <Button onClick={handleSaveOrder}>Criar Pedido</Button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* View/Process Order Modal */}
            <Modal isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} title={`Detalhes do Pedido #${viewingOrder?.id.slice(-6)}`} size="lg">
                {viewingOrder && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start bg-gray-50 p-4 rounded-lg">
                            <div>
                                <p className="text-sm text-gray-500">Fornecedor</p>
                                <p className="font-bold text-lg">{state.suppliers.find(s => s.id === viewingOrder.supplierId)?.name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Status Atual</p>
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase mt-1 ${
                                    viewingOrder.status === 'received' ? 'bg-green-100 text-green-700' :
                                    viewingOrder.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                    'bg-yellow-100 text-yellow-700'
                                }`}>
                                    {viewingOrder.status === 'received' ? 'Recebido' : viewingOrder.status === 'sent' ? 'Enviado' : 'Em Aberto'}
                                </span>
                            </div>
                        </div>

                         <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-3">Produto</th>
                                    <th className="p-3 text-center">Qtd</th>
                                    <th className="p-3 text-right">Custo</th>
                                    <th className="p-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {viewingOrder.items.map((item, idx) => {
                                    const prod = state.products.find(p => p.id === item.productId);
                                    return (
                                        <tr key={idx} className="border-t">
                                            <td className="p-3">{prod?.name}</td>
                                            <td className="p-3 text-center">{item.qty}</td>
                                            <td className="p-3 text-right">{formatCurrency(item.cost)}</td>
                                            <td className="p-3 text-right">{formatCurrency(item.qty * item.cost)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                             <tfoot className="bg-gray-50 font-bold">
                                <tr>
                                    <td colSpan={3} className="p-3 text-right">Total Geral</td>
                                    <td className="p-3 text-right">{formatCurrency(getOrderTotal(viewingOrder.items))}</td>
                                </tr>
                            </tfoot>
                        </table>

                        {viewingOrder.status !== 'received' && (
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                {viewingOrder.status === 'open' && (
                                    <Button onClick={() => handleUpdateStatus(viewingOrder.id, 'sent')}>
                                        Marcar como Enviado
                                    </Button>
                                )}
                                <Button variant="success" onClick={() => handleUpdateStatus(viewingOrder.id, 'received')}>
                                    <Check size={18} /> Confirmar Recebimento (Atualizar Estoque)
                                </Button>
                            </div>
                        )}
                         {viewingOrder.status === 'received' && (
                            <div className="bg-green-50 text-green-700 p-4 rounded-lg text-center text-sm">
                                Este pedido já foi recebido e o estoque foi atualizado.
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

// --- POS (Point of Sale) Component ---

const POS = () => {
    const { state, updateState, notify, logSecurityAction, playSound } = useAppContext();
    const [cart, setCart] = useState<SaleItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [receiptModalOpen, setReceiptModalOpen] = useState(false);
    const [lastSale, setLastSale] = useState<Sale | null>(null);
    const [pinModalAction, setPinModalAction] = useState<{ type: 'void_item' | 'void_sale', payload?: any } | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    
    // Scanner focus handling
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep focus on input for USB scanners
    useEffect(() => {
        const interval = setInterval(() => {
            if (!paymentModalOpen && !receiptModalOpen && !pinModalAction && !isCameraOpen) {
                inputRef.current?.focus();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [paymentModalOpen, receiptModalOpen, pinModalAction, isCameraOpen]);

    const addToCart = (product: Product, qty: number = 1) => {
        if (product.qty <= 0) {
            playSound('error');
            notify(`Produto ${product.name} sem estoque!`, 'error');
            return;
        }

        const existingItem = cart.find(item => item.productId === product.id);
        const currentQtyInCart = existingItem ? existingItem.qty : 0;

        if (currentQtyInCart + qty > product.qty) {
            playSound('error');
            notify(`Estoque insuficiente. Disponível: ${product.qty}`, 'error');
            return;
        }

        playSound('beep');

        if (existingItem) {
            setCart(cart.map(item => item.productId === product.id 
                ? { ...item, qty: item.qty + qty, total: (item.qty + qty) * item.unitPrice } 
                : item
            ));
        } else {
            setCart([...cart, {
                productId: product.id,
                productName: product.name,
                qty: qty,
                unitPrice: product.sellPrice,
                total: product.sellPrice * qty
            }]);
        }
        setSearchTerm('');
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const term = searchTerm.trim();
        if (!term) return;

        // Exact match for barcode first
        const productByBarcode = state.products.find(p => p.barcode === term);
        if (productByBarcode) {
            addToCart(productByBarcode);
            return;
        }

        // Exact match by SKU
        const productBySku = state.products.find(p => p.sku.toLowerCase() === term.toLowerCase());
        if (productBySku) {
            addToCart(productBySku);
            return;
        }
        
        notify("Produto não encontrado via scanner.", "error");
        setSearchTerm('');
    };

    const handleCameraScan = (code: string) => {
         const product = state.products.find(p => p.barcode === code);
         if (product) {
             addToCart(product);
             notify(`${product.name} adicionado!`, 'success');
         } else {
             notify(`Código ${code} não encontrado.`, 'error');
         }
    };

    const initiateVoidItem = (productId: string) => {
        setPinModalAction({ type: 'void_item', payload: productId });
    };

    const initiateVoidSale = () => {
        if(cart.length === 0) return;
        setPinModalAction({ type: 'void_sale' });
    };

    const handleSecuritySuccess = () => {
        if (!pinModalAction) return;

        if (pinModalAction.type === 'void_item') {
            const item = cart.find(i => i.productId === pinModalAction.payload);
            setCart(cart.filter(i => i.productId !== pinModalAction.payload));
            logSecurityAction('remove_item_pos', `Item removido do PDV: ${item?.productName}`);
            notify("Item removido.", "info");
        } else if (pinModalAction.type === 'void_sale') {
            setCart([]);
            logSecurityAction('cancel_sale', `Venda cancelada no PDV (Total: ${formatCurrency(cartTotal)})`);
            notify("Venda cancelada.", "info");
        }
        setPinModalAction(null);
    };

    const cartTotal = cart.reduce((acc, item) => acc + item.total, 0);

    const finalizeSale = (method: 'cash' | 'credit' | 'debit' | 'pix') => {
        const saleId = Date.now().toString();
        const sale: Sale = {
            id: saleId,
            items: cart,
            totalValue: cartTotal,
            paymentMethod: method,
            date: new Date().toISOString(),
            userId: state.currentUser?.id || 'sys',
            userName: state.currentUser?.name || 'Sistema'
        };

        // Create movements and update products
        const newMovements: StockMovement[] = cart.map(item => ({
            id: Date.now().toString() + item.productId,
            productId: item.productId,
            type: 'sale',
            qty: item.qty,
            date: new Date().toISOString(),
            userId: state.currentUser?.id || 'sys',
            userName: state.currentUser?.name || 'Sistema'
        }));

        const updatedProducts = state.products.map(p => {
            const soldItem = cart.find(i => i.productId === p.id);
            if (soldItem) {
                return { ...p, qty: p.qty - soldItem.qty };
            }
            return p;
        });

        updateState({
            sales: [...state.sales, sale],
            movements: [...state.movements, ...newMovements],
            products: updatedProducts
        });

        setLastSale(sale);
        setCart([]);
        setPaymentModalOpen(false);
        setReceiptModalOpen(true);
        playSound('success');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] gap-4 animate-fade-in">
            <PinModal 
                isOpen={!!pinModalAction} 
                onClose={() => setPinModalAction(null)} 
                onSuccess={handleSecuritySuccess}
                title="Autorização Gerencial"
                description={pinModalAction?.type === 'void_sale' ? "Cancelar venda inteira?" : "Remover item do carrinho?"}
            />
            
            {isCameraOpen && <CameraScanner onScan={handleCameraScan} onClose={() => setIsCameraOpen(false)} />}

            {/* Receipt Modal */}
            <Modal isOpen={receiptModalOpen} onClose={() => setReceiptModalOpen(false)} title="Cupom Fiscal" size="sm">
                <div className="bg-white p-4 font-mono text-sm border rounded-lg mb-4 shadow-inner bg-yellow-50/20">
                    <div className="text-center mb-4">
                        <h3 className="font-bold text-lg">MERCADO FÁCIL</h3>
                        <p>Rua Exemplo, 123 - Centro</p>
                        <p>CNPJ: 00.000.000/0001-00</p>
                        <div className="border-b border-dashed border-gray-400 my-2"></div>
                        <p>CUPOM NÃO FISCAL</p>
                    </div>
                    {lastSale?.items.map((item, idx) => (
                         <div key={idx} className="flex justify-between mb-1">
                            <span>{item.qty}x {item.productName.substring(0, 15)}</span>
                            <span>{formatCurrency(item.total)}</span>
                        </div>
                    ))}
                    <div className="border-b border-dashed border-gray-400 my-2"></div>
                    <div className="flex justify-between font-bold text-lg">
                        <span>TOTAL</span>
                        <span>{formatCurrency(lastSale?.totalValue || 0)}</span>
                    </div>
                    <div className="text-right mt-1">
                        Forma Pagto: {lastSale?.paymentMethod.toUpperCase()}
                    </div>
                    <div className="text-center mt-6 text-xs text-gray-500">
                        {lastSale && formatDate(lastSale.date)}<br/>
                        Obrigado pela preferência!
                    </div>
                </div>
                <div className="flex justify-center gap-2">
                    <Button variant="secondary" onClick={() => setReceiptModalOpen(false)}>Fechar</Button>
                    <Button onClick={() => window.print()}><Printer size={16} /> Imprimir</Button>
                </div>
            </Modal>

             {/* Payment Modal */}
             <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Finalizar Venda" size="sm">
                <div className="text-center mb-6">
                    <p className="text-gray-500">Total a Pagar</p>
                    <p className="text-4xl font-bold text-blue-900">{formatCurrency(cartTotal)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => finalizeSale('cash')} className="p-4 rounded-xl border-2 border-green-100 bg-green-50 hover:bg-green-100 flex flex-col items-center gap-2 transition-colors">
                        <span className="text-2xl">💵</span>
                        <span className="font-bold text-green-700">Dinheiro</span>
                    </button>
                    <button onClick={() => finalizeSale('credit')} className="p-4 rounded-xl border-2 border-blue-100 bg-blue-50 hover:bg-blue-100 flex flex-col items-center gap-2 transition-colors">
                        <span className="text-2xl">💳</span>
                        <span className="font-bold text-blue-700">Crédito</span>
                    </button>
                    <button onClick={() => finalizeSale('debit')} className="p-4 rounded-xl border-2 border-orange-100 bg-orange-50 hover:bg-orange-100 flex flex-col items-center gap-2 transition-colors">
                        <span className="text-2xl">🏧</span>
                        <span className="font-bold text-orange-700">Débito</span>
                    </button>
                    <button onClick={() => finalizeSale('pix')} className="p-4 rounded-xl border-2 border-teal-100 bg-teal-50 hover:bg-teal-100 flex flex-col items-center gap-2 transition-colors">
                        <span className="text-2xl">💠</span>
                        <span className="font-bold text-teal-700">PIX</span>
                    </button>
                </div>
            </Modal>

            <div className="flex flex-col md:flex-row gap-4 h-full">
                {/* Left: Product List */}
                <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                        <h2 className="font-bold text-gray-700 flex items-center gap-2">
                            <ShoppingCart size={20} /> Carrinho de Compras
                        </h2>
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">{cart.length} Itens</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300">
                                <ShoppingCart size={64} className="mb-4 opacity-20" />
                                <p className="text-lg">Caixa Livre</p>
                                <p className="text-sm">Aguardando produtos...</p>
                            </div>
                        ) : (
                            cart.map((item, index) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border hover:border-blue-200 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white w-8 h-8 rounded flex items-center justify-center font-bold text-gray-500 border">{index + 1}</div>
                                        <div>
                                            <div className="font-bold text-gray-800">{item.productName}</div>
                                            <div className="text-xs text-gray-500">{item.qty} x {formatCurrency(item.unitPrice)}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="font-bold text-lg text-gray-800">{formatCurrency(item.total)}</div>
                                        <button onClick={() => initiateVoidItem(item.productId)} className="text-gray-400 hover:text-red-500 p-1">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="w-full md:w-96 flex flex-col gap-4">
                    {/* Scanner Input */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <BarcodeScannerMock onScan={(code) => {
                             const product = state.products.find(p => p.barcode === code);
                             if(product) addToCart(product);
                             else notify("Código não encontrado", "error");
                        }} />
                        <form onSubmit={handleSearch} className="relative flex gap-2">
                             <div className="relative flex-1">
                                <input 
                                    ref={inputRef}
                                    type="text" 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Escanear Código..."
                                    className="w-full pl-10 pr-4 py-4 bg-gray-50 border-2 border-blue-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-mono text-lg transition-all"
                                    autoFocus
                                />
                                <Barcode className="absolute left-3 top-5 text-gray-400" />
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setIsCameraOpen(true)}
                                className="bg-gray-800 hover:bg-gray-700 text-white px-4 rounded-xl flex items-center justify-center transition-colors"
                                title="Abrir Câmera"
                            >
                                <Camera size={24} />
                            </button>
                        </form>
                    </div>

                    {/* Total & Actions */}
                    <div className="bg-gray-900 text-white p-6 rounded-xl shadow-lg flex-1 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-gray-400 text-sm uppercase tracking-wider">Total a Pagar</span>
                                <span className="text-green-400 text-xs">Venda #{state.sales.length + 1}</span>
                            </div>
                            <div className="text-5xl font-bold tracking-tight mb-8">
                                {formatCurrency(cartTotal)}
                            </div>
                            
                            <div className="space-y-2 text-sm text-gray-400 mb-8">
                                <div className="flex justify-between border-b border-gray-700 pb-2">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(cartTotal)}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-700 pb-2">
                                    <span>Descontos</span>
                                    <span>R$ 0,00</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={() => setPaymentModalOpen(true)}
                                disabled={cart.length === 0}
                                className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-green-900/20 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Check size={24} /> Finalizar Venda (F2)
                            </button>
                            <button 
                                onClick={initiateVoidSale}
                                disabled={cart.length === 0}
                                className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <X size={18} /> Cancelar Venda
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Stock Control Component ---

const StockControl = () => {
    const { state, updateState, notify, logSecurityAction } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'in' | 'out' | 'adjustment'>('all');

    // Add manual adjustment
    const handleAdjustment = (productId: string, type: 'in' | 'out' | 'adjustment', qty: number, obs: string) => {
        const product = state.products.find(p => p.id === productId);
        if(!product) return;

        const newQty = type === 'in' ? product.qty + qty : product.qty - qty;
        if(newQty < 0) {
            notify("Estoque não pode ficar negativo.", "error");
            return;
        }

        const movement: StockMovement = {
            id: Date.now().toString(),
            productId,
            type,
            qty,
            date: new Date().toISOString(),
            userId: state.currentUser?.id || 'sys',
            userName: state.currentUser?.name || 'User',
            observation: obs
        };

        const updatedProducts = state.products.map(p => p.id === productId ? { ...p, qty: newQty } : p);
        
        updateState({
            products: updatedProducts,
            movements: [movement, ...state.movements]
        });
        
        logSecurityAction('manual_adjustment', `Ajuste manual: ${type === 'in' ? '+' : '-'}${qty} em ${product.name}`);
        notify("Estoque ajustado com sucesso.", "success");
    };

    const filteredMovements = state.movements.filter(m => 
        (filter === 'all' || m.type === filter) &&
        state.products.find(p => p.id === m.productId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-gray-800">Controle de Estoque</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <History size={20} className="text-blue-500" /> Histórico de Movimentações
                    </h3>
                    <div className="flex gap-4 mb-4">
                        <div className="relative flex-1">
                             <input 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar produto..." 
                                className="w-full pl-10 border rounded-lg p-2"
                             />
                             <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        </div>
                        <select className="border rounded-lg p-2" value={filter} onChange={(e: any) => setFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="in">Entradas</option>
                            <option value="out">Saídas</option>
                            <option value="adjustment">Ajustes</option>
                            <option value="sale">Vendas</option>
                        </select>
                    </div>
                    <div className="overflow-y-auto max-h-[500px]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="p-3">Data/Hora</th>
                                    <th className="p-3">Produto</th>
                                    <th className="p-3">Tipo</th>
                                    <th className="p-3 text-right">Qtd.</th>
                                    <th className="p-3">Usuário</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredMovements.map(m => {
                                    const prod = state.products.find(p => p.id === m.productId);
                                    return (
                                        <tr key={m.id} className="hover:bg-gray-50">
                                            <td className="p-3 text-gray-500">{formatDate(m.date)}</td>
                                            <td className="p-3 font-medium">{prod?.name || 'Produto excluído'}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                                                    m.type === 'in' ? 'bg-green-100 text-green-700' :
                                                    m.type === 'out' ? 'bg-red-100 text-red-700' :
                                                    m.type === 'sale' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {m.type === 'in' ? 'Entrada' : m.type === 'out' ? 'Saída' : m.type === 'sale' ? 'Venda' : 'Ajuste'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-bold">{m.qty}</td>
                                            <td className="p-3 text-gray-500 text-xs">{m.userName}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Edit size={20} className="text-orange-500" /> Ajuste Rápido
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                        Use para correções de inventário, perdas, quebras ou bonificações.
                    </p>
                    <AdjustmentForm products={state.products} onAdjust={handleAdjustment} />
                </div>
            </div>
        </div>
    );
};

const AdjustmentForm = ({ products, onAdjust }: { products: Product[], onAdjust: (id: string, type: any, qty: number, obs: string) => void }) => {
    const [selectedId, setSelectedId] = useState('');
    const [type, setType] = useState('adjustment');
    const [qty, setQty] = useState(1);
    const [obs, setObs] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(selectedId && qty > 0) {
            onAdjust(selectedId, type, qty, obs);
            setQty(1);
            setObs('');
            setSelectedId('');
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Produto</label>
                <select className="w-full border rounded p-2" value={selectedId} onChange={e => setSelectedId(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (Atual: {p.qty})</option>)}
                </select>
            </div>
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Tipo de Ajuste</label>
                <select className="w-full border rounded p-2" value={type} onChange={e => setType(e.target.value)}>
                    <option value="in">Entrada (+)</option>
                    <option value="out">Saída (-)</option>
                    <option value="adjustment">Correção (Inventário)</option>
                </select>
            </div>
            <div>
                 <label className="text-xs font-bold text-gray-500 uppercase">Quantidade</label>
                 <input type="number" min="1" className="w-full border rounded p-2" value={qty} onChange={e => setQty(Number(e.target.value))} />
            </div>
             <div>
                 <label className="text-xs font-bold text-gray-500 uppercase">Motivo / Obs</label>
                 <input type="text" className="w-full border rounded p-2" value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: Quebra, Validade..." required />
            </div>
            <Button type="submit" className="w-full">Registrar Ajuste</Button>
        </form>
    );
}

// --- Users Component ---

const UsersManagement = () => {
    const { state, updateState, notify, logSecurityAction } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        
        const user: User = {
            id: editingUser ? editingUser.id : Date.now().toString(),
            name: formData.get('name') as string,
            role: formData.get('role') as any,
        };

        const updatedUsers = editingUser 
            ? state.users.map(u => u.id === user.id ? user : u)
            : [...state.users, user];

        updateState({ users: updatedUsers });
        logSecurityAction('user_management', `${editingUser ? 'Editou' : 'Criou'} usuário: ${user.name}`);
        notify("Usuário salvo com sucesso.", "success");
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const handleDelete = (id: string) => {
        if (state.users.length <= 1) {
            notify("Não é possível excluir o último usuário.", "error");
            return;
        }
        updateState({ users: state.users.filter(u => u.id !== id) });
        logSecurityAction('user_management', `Excluiu usuário ID: ${id}`);
        notify("Usuário removido.", "success");
    };

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Gestão de Usuários</h1>
                <Button onClick={() => { setEditingUser(null); setIsModalOpen(true); }}>
                    <Plus size={20} /> Novo Usuário
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {state.users.map(user => (
                    <div key={user.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
                                user.role === 'admin' ? 'bg-purple-100 text-purple-600' :
                                user.role === 'employee' ? 'bg-blue-100 text-blue-600' :
                                'bg-green-100 text-green-600'
                            }`}>
                                {user.name[0]}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">{user.name}</h3>
                                <span className="text-xs uppercase font-bold tracking-wider text-gray-500">
                                    {user.role === 'admin' ? 'Gerente' : user.role === 'employee' ? 'Funcionário' : 'Caixa'}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setEditingUser(user); setIsModalOpen(true); }} className="p-2 hover:bg-gray-100 rounded text-blue-600"><Edit size={18} /></button>
                            <button onClick={() => handleDelete(user.id)} className="p-2 hover:bg-gray-100 rounded text-red-600"><Trash2 size={18} /></button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? "Editar Usuário" : "Novo Usuário"}>
                 <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                        <input name="name" defaultValue={editingUser?.name} required className="mt-1 block w-full border rounded-lg p-2.5" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nível de Acesso</label>
                        <select name="role" defaultValue={editingUser?.role || 'employee'} className="mt-1 block w-full border rounded-lg p-2.5 bg-white">
                            <option value="admin">Administrador (Gerente)</option>
                            <option value="employee">Funcionário (Estoque)</option>
                            <option value="cashier">Caixa (Vendas)</option>
                        </select>
                    </div>
                    <div className="pt-4 border-t flex justify-end gap-2">
                        <Button variant="secondary" onClick={(e: any) => { e.preventDefault(); setIsModalOpen(false); }}>Cancelar</Button>
                        <Button type="submit">Salvar</Button>
                    </div>
                 </form>
            </Modal>
        </div>
    );
};

// --- Suppliers Component ---

const Suppliers = () => {
  const { state, updateState, notify, logSecurityAction, navigateTo } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | Partial<Supplier> | null>(null);
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const isAdmin = state.currentUser?.role === 'admin';

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const isEditing = editingSupplier && 'id' in editingSupplier;
    const id = isEditing ? (editingSupplier as Supplier).id : Date.now().toString();

    const newSupplier: Supplier = {
      id,
      name: formData.get('name') as string,
      cnpj: formData.get('cnpj') as string,
      contactName: formData.get('contactName') as string,
      representativeName: formData.get('representativeName') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      address: formData.get('address') as string,
    };

    let updatedSuppliers = [...state.suppliers];
    if (isEditing) {
      updatedSuppliers = updatedSuppliers.map(s => s.id === id ? newSupplier : s);
      notify("Fornecedor atualizado!", "success");
    } else {
      updatedSuppliers.push(newSupplier);
      notify("Fornecedor cadastrado!", "success");
    }

    updateState({ suppliers: updatedSuppliers });
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

   const initiateDelete = (id: string) => {
    setPendingDeleteId(id);
    setPinModalOpen(true);
  }

  const confirmDelete = () => {
    if(pendingDeleteId) {
        const s = state.suppliers.find(sup => sup.id === pendingDeleteId);
        const isUsed = state.products.some(p => p.supplierId === pendingDeleteId);
        if(isUsed) {
            notify("Não é possível excluir: existem produtos vinculados.", "error");
            setPendingDeleteId(null);
            return;
        }

        updateState({ suppliers: state.suppliers.filter(sup => sup.id !== pendingDeleteId) });
        logSecurityAction('user_management', `Fornecedor excluído: ${s?.name}`);
        notify("Fornecedor removido.", "info");
        setPendingDeleteId(null);
    }
  };

  const getSupplierOrders = (supplierId: string) => {
    return state.orders
        .filter(o => o.supplierId === supplierId)
        .sort((a: PurchaseOrder, b: PurchaseOrder) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
  };

  const getOrderTotal = (order: PurchaseOrder) => {
    return order.items.reduce((acc, item) => acc + (item.cost * item.qty), 0);
  };

  const filteredSuppliers = state.suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.contactName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PinModal isOpen={pinModalOpen} onClose={() => setPinModalOpen(false)} onSuccess={confirmDelete} title="Excluir Fornecedor" />

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Gerenciar Fornecedores</h1>
        {isAdmin && (
          <Button onClick={() => { setEditingSupplier(null); setIsModalOpen(true); }}>
            <Plus size={20} /> Novo Fornecedor
          </Button>
        )}
      </div>

       <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative">
          <input 
            type="text" 
            placeholder="Buscar fornecedor por nome ou contato..." 
            className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-3.5 text-gray-400" size={20} /> 
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.map(s => (
            <div key={s.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-lg text-gray-900">{s.name}</h3>
                        <p className="text-xs text-gray-500">{s.cnpj}</p>
                    </div>
                    <div className="flex gap-1">
                         <button 
                            onClick={() => setExpandedSupplierId(expandedSupplierId === s.id ? null : s.id)} 
                            className={`p-1.5 rounded transition-colors ${expandedSupplierId === s.id ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`} 
                            title="Ver Histórico de Pedidos"
                         >
                            <ClipboardList size={16} />
                         </button>
                         {isAdmin && (
                            <>
                                <button onClick={() => { setEditingSupplier(s); setIsModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16} /></button>
                                <button onClick={() => initiateDelete(s.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                            </>
                         )}
                    </div>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                        <UserIcon size={16} className="text-gray-400" />
                        <span>Contato: {s.contactName}</span>
                    </div>
                    {s.representativeName && (
                        <div className="flex items-center gap-2">
                            <div className="w-4 flex justify-center"><Briefcase size={14} className="text-gray-400" /></div>
                            <span>Rep: {s.representativeName}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="w-4 flex justify-center"><span className="text-gray-400 text-xs">📞</span></div>
                        <span>{s.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                         <div className="w-4 flex justify-center"><span className="text-gray-400 text-xs">✉️</span></div>
                        <span className="truncate max-w-[200px]" title={s.email}>{s.email}</span>
                    </div>
                    <div className="flex items-start gap-2">
                         <div className="w-4 flex justify-center mt-0.5"><span className="text-gray-400 text-xs">📍</span></div>
                        <span className="text-xs">{s.address}</span>
                    </div>
                </div>

                {/* Expandable History Section */}
                {expandedSupplierId === s.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <History size={16} className="text-blue-500"/> Histórico de Compras
                            </h4>
                            <button onClick={() => navigateTo('purchases')} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 flex items-center gap-1">
                                <Plus size={10} /> Novo Pedido
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                         {getSupplierOrders(s.id).length > 0 ? (
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="p-2">Data</th>
                                        <th className="p-2 text-center">Status</th>
                                        <th className="p-2 text-center">Itens</th>
                                        <th className="p-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {getSupplierOrders(s.id).map(order => (
                                        <tr key={order.id} className="cursor-pointer hover:bg-gray-50" title="Ver detalhes (em Compras)">
                                            <td className="p-2">{formatDate(order.dateCreated).split(' ')[0]}</td>
                                            <td className="p-2 text-center">
                                                 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                     order.status === 'received' ? 'bg-green-100 text-green-700' :
                                                     order.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                                     'bg-yellow-100 text-yellow-700'
                                                 }`}>
                                                     {order.status === 'received' ? 'Rec' : order.status === 'sent' ? 'Env' : 'Ab'}
                                                 </span>
                                            </td>
                                            <td className="p-2 text-center">{order.items.length}</td>
                                            <td className="p-2 text-right font-medium">{formatCurrency(getOrderTotal(order))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         ) : (
                            <p className="text-xs text-gray-400 italic text-center py-2">Nenhum pedido encontrado.</p>
                         )}
                        </div>
                    </div>
                )}
            </div>
        ))}
      </div>

      <Modal 
         isOpen={isModalOpen} 
         onClose={() => setIsModalOpen(false)} 
         title={editingSupplier && 'id' in editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
      >
        <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome da Empresa</label>
              <input name="name" defaultValue={editingSupplier?.name} required className="mt-1 block w-full border rounded-lg p-2.5" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">CNPJ</label>
                    <input name="cnpj" defaultValue={editingSupplier?.cnpj} required className="mt-1 block w-full border rounded-lg p-2.5" placeholder="00.000.000/0000-00" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Telefone</label>
                    <input name="phone" defaultValue={editingSupplier?.phone} required className="mt-1 block w-full border rounded-lg p-2.5" placeholder="(00) 00000-0000" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-sm font-medium text-gray-700">Pessoa de Contato</label>
                  <input name="contactName" defaultValue={editingSupplier?.contactName} required className="mt-1 block w-full border rounded-lg p-2.5" placeholder="Ex: Financeiro/Atendimento" />
                </div>
                 <div>
                  <label className="block text-sm font-medium text-gray-700">Nome do Representante</label>
                  <input name="representativeName" defaultValue={editingSupplier?.representativeName} className="mt-1 block w-full border rounded-lg p-2.5" placeholder="Ex: Vendedor Responsável" />
                </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" defaultValue={editingSupplier?.email} className="mt-1 block w-full border rounded-lg p-2.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Endereço Completo</label>
              <input name="address" defaultValue={editingSupplier?.address} required className="mt-1 block w-full border rounded-lg p-2.5" placeholder="Rua, Número, Bairro, Cidade - UF" />
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <Button variant="secondary" onClick={(e: any) => { e.preventDefault(); setIsModalOpen(false); }}>Cancelar</Button>
                <Button type="submit">Salvar Fornecedor</Button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

const Reports = () => {
    const { state } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');

    const inventoryData = state.products.map(p => {
        const productMovements = state.movements
            .filter(m => m.productId === p.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const lastMove = productMovements.length > 0 ? productMovements[0].date : null;
        
        return {
            ...p,
            totalCost: p.qty * p.costPrice,
            totalSell: p.qty * p.sellPrice,
            lastMove
        };
    }).filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalStockCost = inventoryData.reduce((acc, curr) => acc + curr.totalCost, 0);
    const totalStockSell = inventoryData.reduce((acc, curr) => acc + curr.totalSell, 0);

    const exportToCSV = () => {
        const headers = ["Produto", "SKU", "Categoria", "Estoque Atual", "Unidade", "Custo Unit.", "Venda Unit.", "Total Custo", "Total Venda", "Ultima Movimentacao"];
        const rows = inventoryData.map(p => [
            `"${p.name}"`, `"${p.sku}"`, `"${p.category}"`, p.qty, p.unit,
            p.costPrice.toFixed(2).replace('.', ','), p.sellPrice.toFixed(2).replace('.', ','),
            p.totalCost.toFixed(2).replace('.', ','), p.totalSell.toFixed(2).replace('.', ','),
            p.lastMove ? formatDate(p.lastMove) : 'N/A'
        ]);
        const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `inventario_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Relatórios Gerenciais</h1>
                <Button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700 text-white">
                    <Download size={20} /> Exportar CSV
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm">Custo Total em Estoque</h3>
                    <p className="text-2xl font-bold mt-2 text-blue-900">{formatCurrency(totalStockCost)}</p>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm">Valor de Venda Potencial</h3>
                    <p className="text-2xl font-bold mt-2 text-green-700">{formatCurrency(totalStockSell)}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 relative flex-1 min-h-0 flex flex-col">
                <h3 className="font-bold text-gray-700 mb-4">Detalhamento de Estoque</h3>
                <div className="mb-4 relative">
                     <input 
                        type="text" 
                        placeholder="Filtrar por nome..." 
                        className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} /> 
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 border-b">
                            <tr>
                                <th className="p-3">Produto</th>
                                <th className="p-3 text-center">Qtd.</th>
                                <th className="p-3 text-right">Custo</th>
                                <th className="p-3 text-right">Venda</th>
                                <th className="p-3 text-right">Total (Venda)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {inventoryData.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-medium">{p.name}</td>
                                    <td className="p-3 text-center">{p.qty}</td>
                                    <td className="p-3 text-right">{formatCurrency(p.costPrice)}</td>
                                    <td className="p-3 text-right">{formatCurrency(p.sellPrice)}</td>
                                    <td className="p-3 text-right font-medium text-green-600">{formatCurrency(p.totalSell)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { state, updateState, notify } = useAppContext();
    const [analysis, setAnalysis] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const handleAnalyze = async () => {
        setLoading(true);
        const result = await generateInventoryAnalysis(state.products, state.movements);
        setAnalysis(result);
        setLoading(false);
    }

     const handleBackup = () => {
        const dataStr = JSON.stringify(state);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `mercadofacil_backup_${new Date().toISOString()}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Visão Geral</h1>
                {state.currentUser?.role === 'admin' && (
                     <Button variant="outline" onClick={handleBackup} className="text-sm px-3 py-1">
                        <Save size={16} /> Backup Dados
                    </Button>
                )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg text-white">
                    <h3 className="text-blue-100 text-sm mb-1">Total de Produtos</h3>
                    <p className="text-3xl font-bold">{state.products.length}</p>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm mb-1">Abaixo do Mínimo</h3>
                    <p className="text-3xl font-bold text-red-500">{state.products.filter(p => p.qty <= p.minQty).length}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                     <h3 className="text-gray-500 text-sm mb-1">Valor em Estoque</h3>
                     <p className="text-3xl font-bold text-gray-800">{formatCurrency(state.products.reduce((acc, p) => acc + (p.qty * p.costPrice), 0))}</p>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                     <h3 className="text-gray-500 text-sm mb-1">Vendas Hoje</h3>
                     <p className="text-3xl font-bold text-green-600">
                        {formatCurrency(state.sales.filter(s => new Date(s.date).toDateString() === new Date().toDateString()).reduce((acc, s) => acc + s.totalValue, 0))}
                     </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-0 relative">
                     <h3 className="font-bold text-gray-700 mb-4">Top 5 Produtos (Estoque)</h3>
                     <div className="flex-1 min-h-0 min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsBar data={[...state.products].sort((a,b) => b.qty - a.qty).slice(0,5)}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" hide />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="qty" fill="#3b82f6" radius={[4,4,0,0]} name="Quantidade" />
                            </RechartsBar>
                        </ResponsiveContainer>
                     </div>
                </div>
                
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-0 relative">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                             <span className="text-purple-500">✨</span> IA do Mercado
                        </h3>
                        <Button onClick={handleAnalyze} disabled={loading} variant="secondary" className="text-xs">
                            {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Gerar Análise'}
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed border border-gray-100">
                        {analysis ? analysis : "Clique em 'Gerar Análise' para receber dicas sobre seu estoque e vendas."}
                    </div>
                </div>
            </div>
        </div>
    )
}

const Login = () => {
    const { state, updateState } = useAppContext();
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
                <div className="text-center mb-8">
                    <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                        <Package size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-blue-900">Mercado Fácil</h1>
                    <p className="text-gray-500">Sistema de Gestão Integrado</p>
                </div>
                <div className="space-y-3">
                    {state.users.map(u => (
                        <button
                            key={u.id}
                            onClick={() => updateState({ currentUser: u })}
                            className="w-full p-4 text-left border rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all flex items-center gap-3 group"
                        >
                            <div className={`p-2 rounded-full ${
                                u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 
                                u.role === 'employee' ? 'bg-blue-100 text-blue-600' : 
                                'bg-green-100 text-green-600'
                            } group-hover:scale-110 transition-transform`}>
                                <UserIcon size={20} />
                            </div>
                            <div>
                                <div className="font-bold text-gray-800">{u.name}</div>
                                <div className="text-xs text-gray-500 capitalize">
                                    {u.role === 'admin' ? 'Gerente Geral' : u.role === 'employee' ? 'Estoquista' : 'Caixa'}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                 <div className="mt-8 text-center text-xs text-gray-400">
                    v4.0.0 • Seguro & Eficiente
                </div>
            </div>
        </div>
    );
};

// --- App Layout & Provider ---

const AppContent = () => {
  const { state, logout } = useAppContext();
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Expose navigation to context via a hack (in a real app, use router)
  const { updateState } = useAppContext();
  useEffect(() => {
    // This effect is just to allow the context to drive navigation if needed,
    // but React structure here prevents easy uplifting without refactor.
    // We will pass `setCurrentView` down if needed or use a custom event.
  }, []);

  if (!state.currentUser) return <Login />;

  const NavItem = ({ id, label, icon: Icon, restrictedTo }: any) => {
      if (restrictedTo && !restrictedTo.includes(state.currentUser?.role)) return null;
      return (
        <button
        onClick={() => { setCurrentView(id); setIsMobileMenuOpen(false); }}
        className={`w-full flex items-center gap-3 p-3 rounded-lg mb-1 transition-colors ${
            currentView === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`}
        >
        <Icon size={20} />
        <span>{label}</span>
        </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 bg-gray-900 text-white w-64 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 z-30 flex flex-col shadow-2xl`}>
            <div className="p-6 border-b border-gray-800">
                <h1 className="text-xl font-bold flex items-center gap-2 tracking-tight">
                    <div className="bg-blue-600 p-1.5 rounded-lg">
                        <Package className="text-white" size={20} />
                    </div>
                     Mercado Fácil
                </h1>
            </div>
            
            <nav className="flex-1 p-4 overflow-y-auto space-y-1">
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 mt-2 px-2">Geral</div>
                <NavItem id="dashboard" label="Visão Geral" icon={LayoutDashboard} />
                <NavItem id="pos" label="Caixa (PDV)" icon={ShoppingCart} />
                
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 mt-6 px-2">Gestão</div>
                <NavItem id="products" label="Produtos" icon={Package} />
                <NavItem id="stock" label="Estoque" icon={ClipboardList} restrictedTo={['admin', 'employee']} />
                <NavItem id="purchases" label="Compras" icon={FileText} restrictedTo={['admin', 'employee']} />
                <NavItem id="suppliers" label="Fornecedores" icon={Truck} restrictedTo={['admin']} />
                
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 mt-6 px-2">Admin</div>
                <NavItem id="reports" label="Relatórios" icon={BarChart} restrictedTo={['admin']} />
                <NavItem id="users" label="Usuários" icon={Users} restrictedTo={['admin']} />
            </nav>

            <div className="p-4 border-t border-gray-800 bg-gray-900/50">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white shadow-lg">
                        {state.currentUser.name[0]}
                    </div>
                    <div className="overflow-hidden">
                        <div className="font-bold text-sm truncate text-white">{state.currentUser.name}</div>
                        <div className="text-xs text-gray-400 capitalize flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            {state.currentUser.role === 'admin' ? 'Gerente' : state.currentUser.role === 'employee' ? 'Func.' : 'Caixa'}
                        </div>
                    </div>
                </div>
                <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 p-2 rounded-lg text-sm transition-colors">
                    <LogOut size={16} /> Encerrar Sessão
                </button>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all">
            {/* Mobile Header */}
            <div className="md:hidden bg-white shadow-sm p-4 flex items-center justify-between sticky top-0 z-20 border-b">
                <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600">
                    <Menu />
                </button>
                <span className="font-bold text-gray-800">Mercado Fácil</span>
                <div className="w-6" />
            </div>

            <main className="p-4 md:p-8 flex-1 overflow-x-hidden">
                {currentView === 'dashboard' && <Dashboard />}
                {currentView === 'pos' && <POS />}
                {currentView === 'products' && <Products />}
                {currentView === 'stock' && <StockControl />}
                {currentView === 'purchases' && <Purchases />}
                {currentView === 'users' && <UsersManagement />}
                {currentView === 'suppliers' && <Suppliers />}
                {currentView === 'reports' && <Reports />}
            </main>
        </div>
        
        {/* Overlay for mobile menu */}
        {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
        )}
    </div>
  );
};

const ToastContainer = () => {
    const [toast, setToast] = useState<{msg: string, type: string} | null>(null);
    
    useEffect(() => {
        const handle = (e: any) => {
            setToast({ msg: e.detail.message, type: e.detail.type });
            setTimeout(() => setToast(null), 3000);
        };
        window.addEventListener('app-notification', handle);
        return () => window.removeEventListener('app-notification', handle);
    }, []);

    if (!toast) return null;

    const colors = {
        success: 'bg-green-600 border-green-700 text-white',
        error: 'bg-red-600 border-red-700 text-white',
        info: 'bg-blue-600 border-blue-700 text-white'
    };

    return (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl z-50 animate-bounce-in border flex items-center gap-3 ${colors[toast.type as keyof typeof colors]}`}>
            {toast.type === 'success' && <Check size={20} />}
            {toast.type === 'error' && <AlertTriangle size={20} />}
            <span className="font-medium">{toast.msg}</span>
        </div>
    );
};

export default function App() {
  const [state, setState] = useState<AppState>(getAppState());
  // Hack to allow global navigation from nested components
  const [view, setView] = useState('dashboard');

  const updateState = (newState: Partial<AppState>) => {
    const updated = { ...state, ...newState };
    setState(updated);
    saveAppState(updated);
  };

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const event = new CustomEvent('app-notification', { detail: { message, type } });
    window.dispatchEvent(event);
  };

  const logSecurityAction = (action: SecurityAction, description: string, overrideUser?: string) => {
    const log: any = {
      id: Date.now().toString(),
      action,
      description,
      userId: state.currentUser?.id || 'system',
      userName: state.currentUser?.name || 'System',
      authorizedBy: overrideUser,
      timestamp: new Date().toISOString()
    };
    updateState({ securityLogs: [...state.securityLogs, log] });
  };

  const logout = () => {
    updateState({ currentUser: null });
  };

  // Rewrite AppContent to accept the view state from parent
  const AppContentWrapper = () => {
      const { state, logout } = useAppContext();
      const [currentView, setCurrentView] = useState('dashboard');
      const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

      // Listen for navigation events
      useEffect(() => {
        const handleNav = (e: any) => {
            setCurrentView(e.detail);
        };
        window.addEventListener('app-navigation', handleNav);
        return () => window.removeEventListener('app-navigation', handleNav);
      }, []);

      if (!state.currentUser) return <Login />;

      const NavItem = ({ id, label, icon: Icon, restrictedTo }: any) => {
        if (restrictedTo && !restrictedTo.includes(state.currentUser?.role)) return null;
        return (
            <button
            onClick={() => { setCurrentView(id); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg mb-1 transition-colors ${
                currentView === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
            >
            <Icon size={20} />
            <span>{label}</span>
            </button>
        );
      };

      return (
        <div className="min-h-screen bg-gray-50 flex font-sans">
            <div className={`fixed inset-y-0 left-0 bg-gray-900 text-white w-64 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 z-30 flex flex-col shadow-2xl`}>
                <div className="p-6 border-b border-gray-800">
                    <h1 className="text-xl font-bold flex items-center gap-2 tracking-tight">
                        <div className="bg-blue-600 p-1.5 rounded-lg">
                            <Package className="text-white" size={20} />
                        </div>
                        Mercado Fácil
                    </h1>
                </div>
                
                <nav className="flex-1 p-4 overflow-y-auto space-y-1">
                    <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 mt-2 px-2">Geral</div>
                    <NavItem id="dashboard" label="Visão Geral" icon={LayoutDashboard} />
                    <NavItem id="pos" label="Caixa (PDV)" icon={ShoppingCart} />
                    
                    <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 mt-6 px-2">Gestão</div>
                    <NavItem id="products" label="Produtos" icon={Package} />
                    <NavItem id="stock" label="Estoque" icon={ClipboardList} restrictedTo={['admin', 'employee']} />
                    <NavItem id="purchases" label="Compras" icon={FileText} restrictedTo={['admin', 'employee']} />
                    <NavItem id="suppliers" label="Fornecedores" icon={Truck} restrictedTo={['admin']} />
                    
                    <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 mt-6 px-2">Admin</div>
                    <NavItem id="reports" label="Relatórios" icon={BarChart} restrictedTo={['admin']} />
                    <NavItem id="users" label="Usuários" icon={Users} restrictedTo={['admin']} />
                </nav>

                <div className="p-4 border-t border-gray-800 bg-gray-900/50">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white shadow-lg">
                            {state.currentUser.name[0]}
                        </div>
                        <div className="overflow-hidden">
                            <div className="font-bold text-sm truncate text-white">{state.currentUser.name}</div>
                            <div className="text-xs text-gray-400 capitalize flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                {state.currentUser.role === 'admin' ? 'Gerente' : state.currentUser.role === 'employee' ? 'Func.' : 'Caixa'}
                            </div>
                        </div>
                    </div>
                    <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 p-2 rounded-lg text-sm transition-colors">
                        <LogOut size={16} /> Encerrar Sessão
                    </button>
                </div>
            </div>

            <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all">
                <div className="md:hidden bg-white shadow-sm p-4 flex items-center justify-between sticky top-0 z-20 border-b">
                    <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600">
                        <Menu />
                    </button>
                    <span className="font-bold text-gray-800">Mercado Fácil</span>
                    <div className="w-6" />
                </div>

                <main className="p-4 md:p-8 flex-1 overflow-x-hidden">
                    {currentView === 'dashboard' && <Dashboard />}
                    {currentView === 'pos' && <POS />}
                    {currentView === 'products' && <Products />}
                    {currentView === 'stock' && <StockControl />}
                    {currentView === 'purchases' && <Purchases />}
                    {currentView === 'users' && <UsersManagement />}
                    {currentView === 'suppliers' && <Suppliers />}
                    {currentView === 'reports' && <Reports />}
                </main>
            </div>
            
            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
            )}
        </div>
      );
  }

  const navigateTo = (view: string) => {
      const event = new CustomEvent('app-navigation', { detail: view });
      window.dispatchEvent(event);
  }

  return (
    <AppContext.Provider value={{ state, updateState, notify, logSecurityAction, logout, playSound, navigateTo }}>
       <AppContentWrapper />
       <ToastContainer />
    </AppContext.Provider>
  );
}