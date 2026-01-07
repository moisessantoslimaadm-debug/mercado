import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AlertTriangle, Edit, Trash2, Plus, Search, Package, ShoppingCart, 
  Truck, BarChart2, LogOut, Sparkles, Menu, X, User as UserIcon, 
  Camera, Check, Printer, DollarSign, Archive, ShieldAlert, ChevronRight,
  CreditCard, Banknote, QrCode, Settings, FileText, Upload, Download,
  ArrowUpCircle, ArrowDownCircle, History, RefreshCcw, Save, Image as ImageIcon,
  FileSpreadsheet, LayoutDashboard, TrendingUp, PieChart as PieChartIcon, Calendar, Filter,
  RefreshCw
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { getAppState, saveAppState } from './services/storage';
import { generateInventoryAnalysis } from './services/geminiService';
import { AppState, Product, User, Sale, SaleItem, Supplier, StockMovement, PurchaseOrder } from './types';
import { formatCurrency, formatDate, CATEGORIES, UNITS } from './constants';

// --- HELPERS ---

// Singleton AudioContext to prevent running out of hardware contexts
let audioCtx: AudioContext | null = null;

const playBeep = () => {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        // Resume context if suspended (browser policy)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        console.error("Audio context error", e);
    }
};

// --- COMPONENTS ---

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'warning', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000); // Increased duration slightly for better readability
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-green-600', // Darker green for better visibility
    error: 'bg-red-600',
    warning: 'bg-orange-500'
  };

  return (
    <div className={`fixed top-4 right-4 z-[60] ${bgColors[type]} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-fade-in transition-all transform hover:scale-105 max-w-sm border border-white/10`}>
      <div className="bg-white/20 p-2 rounded-full">
          {type === 'success' && <Check size={20} />}
          {type === 'error' && <AlertTriangle size={20} />}
          {type === 'warning' && <ShieldAlert size={20} />}
      </div>
      <span className="font-medium text-sm leading-tight">{message}</span>
      <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100"><X size={18} /></button>
    </div>
  );
};

const AlertBanner = ({ count, onClick }: { count: number, onClick: () => void }) => (
  <div onClick={onClick} className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors shadow-sm">
      <div className="flex items-center gap-3">
          <div className="bg-red-100 p-2 rounded-full"><AlertTriangle className="text-red-600" size={20} /></div>
          <div>
              <p className="font-bold text-red-800">Atenção Necessária</p>
              <p className="text-sm text-red-600">{count} produtos estão com estoque baixo ou zerado.</p>
          </div>
      </div>
      <ChevronRight className="text-red-400" />
  </div>
);

const CameraScanner = ({ onScan, onClose }: { onScan: (code: string) => void, onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let interval: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          if (!('BarcodeDetector' in window)) {
             setError("Modo Simulação (API nativa ausente). Simulando leitura em 3s...");
             setTimeout(() => { 
                 if(!lastScanned) handleCodeDetected("7891234567890"); 
             }, 3000);
          } else {
             // @ts-ignore
             const barcodeDetector = new window.BarcodeDetector({ formats: ['ean_13', 'qr_code'] });
             interval = window.setInterval(async () => {
                if (videoRef.current) {
                   try {
                      const barcodes = await barcodeDetector.detect(videoRef.current);
                      if (barcodes.length > 0) handleCodeDetected(barcodes[0].rawValue);
                   } catch (e) { console.error(e); }
                }
             }, 300);
          }
        }
      } catch (err) {
        setError('Erro ao acessar câmera. Verifique permissões ou HTTPS.');
      }
    };

    const handleCodeDetected = (code: string) => {
        setLastScanned(prev => {
            if (prev === code) return prev;
            playBeep();
            onScanRef.current(code);
            setTimeout(() => setLastScanned(null), 2000);
            return code;
        });
    };

    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      clearInterval(interval);
    };
  }, []); 

  return (
    <div className="fixed inset-0 bg-black z-[70] flex flex-col items-center justify-center">
      <div className="relative w-full max-w-md bg-black h-full flex flex-col">
        <div className="absolute top-4 right-4 z-10">
          <button onClick={onClose} className="p-2 bg-white/20 rounded-full text-white hover:bg-white/30"><X size={24} /></button>
        </div>
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-64 h-48 border-4 ${lastScanned ? 'border-green-500 scale-105' : 'border-red-500'} rounded-lg transition-all duration-200 opacity-80 relative`}>
                {!lastScanned && (
                    <>
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-red-500 -mt-1 -ml-1"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-red-500 -mt-1 -mr-1"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-red-500 -mb-1 -ml-1"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-red-500 -mb-1 -mr-1"></div>
                    </>
                )}
            </div>
        </div>
        <div className="absolute bottom-10 left-0 w-full text-center p-4">
             <p className="text-white font-bold mb-2">{lastScanned ? `Lido: ${lastScanned}` : 'Aponte para o código de barras'}</p>
            {error && <div className="text-white bg-red-600/80 p-2 rounded text-sm mx-4">{error}</div>}
        </div>
      </div>
    </div>
  );
};

const ReceiptModal = ({ sale, onClose }: { sale: Sale, onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h2 className="font-bold text-gray-800 flex items-center gap-2"><Check className="text-green-500" /> Venda Realizada</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100 flex justify-center">
          <div id="receipt-print-area" className="bg-white p-4 w-80 shadow-sm text-xs font-mono border border-gray-200">
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold">MERCADO FÁCIL</h1>
              <p>Rua do Comércio, 123 - Centro</p>
              <p>{formatDate(sale.date)}</p>
              <p>Op: {sale.userName}</p>
            </div>
            <div className="border-b border-dashed border-gray-300 my-2"></div>
            <div className="space-y-1">
              {sale.items.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="truncate w-32">{item.productName}</span>
                  <span>{item.qty}x {item.unitPrice.toFixed(2)}</span>
                  <span className="font-bold">{item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-b border-dashed border-gray-300 my-2"></div>
            <div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{formatCurrency(sale.totalValue)}</span></div>
            <div className="flex justify-between text-xs mt-1"><span>Pagamento</span><span className="uppercase">{sale.paymentMethod}</span></div>
            <div className="mt-6 text-center text-[10px] text-gray-500"><p>Obrigado pela preferência!</p><p>Volte sempre</p></div>
          </div>
        </div>
        <div className="p-4 border-t bg-white rounded-b-lg flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Fechar</button>
          <button onClick={() => window.print()} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium shadow-md transition-all active:scale-95"><Printer size={18} /> Imprimir</button>
        </div>
      </div>
    </div>
  );
};

const PinModal = ({ onSubmit, onClose }: { onSubmit: (pin: string) => void, onClose: () => void }) => {
    const [pin, setPin] = useState('');
    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in">
            <div className="bg-white p-6 rounded-xl w-72 shadow-2xl animate-scale-in border-t-4 border-red-500">
                <div className="flex justify-center mb-4 text-red-500"><ShieldAlert size={40} /></div>
                <h3 className="text-center font-bold text-gray-800 mb-2">Autorização Necessária</h3>
                <p className="text-center text-xs text-gray-500 mb-4">Insira a senha do Gerente</p>
                <input type="password" autoFocus className="w-full text-center text-2xl tracking-widest border-2 border-gray-200 rounded-lg p-2 mb-4 focus:border-red-500 outline-none transition-colors" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} />
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700">Cancelar</button>
                    <button onClick={() => onSubmit(pin)} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md transition-all active:scale-95">Autorizar</button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP ---

export default function App() {
  const [state, setState] = useState<AppState>(getAppState());
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error' | 'warning'} | null>(null);
  const [showPinModal, setShowPinModal] = useState<{action: string, payload?: any} | null>(null);
  
  // Modals State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [previewImage, setPreviewImage] = useState<string>(''); // Image Preview State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'in' | 'out' | 'adjustment'>('in');
  
  // Purchase Modal State (Optimized)
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [preSelectedSupplierId, setPreSelectedSupplierId] = useState<string>('');

  const [viewingHistoryProduct, setViewingHistoryProduct] = useState<Product | null>(null);
  
  // Data State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  
  // POS State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [posSearch, setPosSearch] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash'|'credit'|'debit'|'pix'>('cash');
  const posInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { saveAppState(state); }, [state]);

  const showToast = (msg: string, type: 'success' | 'error' | 'warning') => setToast({ msg, type });

  // Permissions Helper
  const canEditPrices = state.currentUser?.role === 'admin';
  const canDelete = state.currentUser?.role === 'admin';
  const canManageSettings = state.currentUser?.role === 'admin';

  // --- ACTIONS ---

  const handleLogin = (user: User) => {
      setState(prev => ({ ...prev, currentUser: user }));
      setActiveTab('dashboard'); // Reset tab on login
  };
  const handleLogout = () => setState(prev => ({ ...prev, currentUser: null }));

  const generateEAN = () => '789' + Date.now().toString().slice(-10);

  const openPurchaseForSupplier = (supplierId: string) => {
      setPreSelectedSupplierId(supplierId);
      setIsPurchaseModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setPreviewImage(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Resolve Prices to check validation
    const currentCost = editingProduct ? editingProduct.costPrice : 0;
    const currentSell = editingProduct ? editingProduct.sellPrice : 0;
    
    // Get values from form if editable, otherwise use current state
    const costPrice = canEditPrices ? Number(formData.get('costPrice')) : currentCost;
    const sellPrice = canEditPrices ? Number(formData.get('sellPrice')) : currentSell;
    const minQty = Number(formData.get('minQty'));
    
    // --- VALIDATIONS ---
    
    // 1. Min Qty Validation
    if (minQty < 0 || isNaN(minQty)) {
        showToast('Quantidade mínima não pode ser negativa.', 'error');
        return;
    }

    // 2. Price Positivity Validation
    if (costPrice < 0 || sellPrice < 0) {
        showToast('Os preços não podem ser negativos.', 'error');
        return;
    }

    // 3. Profit Validation (Sell > Cost)
    if (sellPrice <= costPrice) {
        showToast('O preço de venda deve ser maior que o preço de custo.', 'error');
        return;
    }

    // 4. Initial Stock Validation (New Products)
    if (!editingProduct) {
        const initialQty = Number(formData.get('qty'));
        if (initialQty < 0 || isNaN(initialQty)) {
            showToast('Estoque inicial não pode ser negativo.', 'error');
            return;
        }
        if (initialQty > 99999) {
            showToast('Quantidade inicial excede o limite permitido.', 'error');
            return;
        }
    }

    // --- PROCESS ---

    const imageFile = formData.get('imageFile') as File;
    let imageUrl = editingProduct?.imageUrl || '';
    
    if (previewImage) {
        imageUrl = previewImage;
    } else if (imageFile && imageFile.size > 0) {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        await new Promise(resolve => reader.onload = () => { imageUrl = reader.result as string; resolve(true); });
    }

    const productData: Product = {
      id: editingProduct ? editingProduct.id : Date.now().toString(),
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      sku: formData.get('sku') as string,
      barcode: (formData.get('barcode') as string) || generateEAN(),
      qty: editingProduct ? editingProduct.qty : Number(formData.get('qty')),
      minQty: minQty,
      costPrice: costPrice,
      sellPrice: sellPrice,
      unit: formData.get('unit') as string,
      supplierId: formData.get('supplierId') as string,
      imageUrl
    };

    setState(prev => {
      const newProducts = editingProduct 
        ? prev.products.map(p => p.id === editingProduct.id ? productData : p)
        : [...prev.products, productData];
      
      let newMovements = prev.movements;
      if (!editingProduct && productData.qty > 0) {
          newMovements = [...prev.movements, {
              id: Date.now().toString(), productId: productData.id, type: 'in', qty: productData.qty,
              date: new Date().toISOString(), userId: state.currentUser!.id, userName: state.currentUser!.name, observation: 'Estoque Inicial'
          }];
      }
      return { ...prev, products: newProducts, movements: newMovements };
    });
    
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setPreviewImage('');
    showToast('Produto salvo com sucesso!', 'success');
  };

  const handleStockAdjustment = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const type = adjustmentType;
      const qty = Number(formData.get('qty'));
      const obs = formData.get('obs') as string;
      
      // Get new prices if provided (only for 'in' or 'adjustment')
      const inputCostPrice = formData.get('costPrice') ? Number(formData.get('costPrice')) : null;
      const inputSellPrice = formData.get('sellPrice') ? Number(formData.get('sellPrice')) : null;

      if (!adjustingProduct) return;

      // Validation
      if (isNaN(qty) || qty <= 0) {
          showToast('A quantidade deve ser maior que zero.', 'error');
          return;
      }
      if (qty > 99999) {
          showToast('Quantidade excede o limite de segurança.', 'error');
          return;
      }

      if (type === 'out' && adjustingProduct.qty < qty) {
          showToast(`Estoque insuficiente. Atual: ${adjustingProduct.qty}`, 'error');
          return;
      }

      setState(prev => {
          const newProducts = prev.products.map(p => {
              if (p.id === adjustingProduct.id) {
                  let newQty = p.qty;
                  let newCost = p.costPrice;
                  let newSell = p.sellPrice;

                  if (type === 'in') {
                      // Weighted Average Cost Logic
                      if (inputCostPrice !== null) {
                          const currentTotalValue = Math.max(0, p.qty) * p.costPrice;
                          const incomingTotalValue = qty * inputCostPrice;
                          const totalQty = Math.max(0, p.qty) + qty;
                          newCost = totalQty > 0 ? (currentTotalValue + incomingTotalValue) / totalQty : inputCostPrice;
                      }
                      if (inputSellPrice !== null) {
                          newSell = inputSellPrice;
                      }
                      newQty += qty;
                  } else if (type === 'out') {
                      newQty -= qty;
                  } else {
                      // Adjustment - overwrite logic could be applied, but standard adjustment usually just fixes qty. 
                      // If user provided prices in adjustment, we update them.
                      if (inputCostPrice !== null) newCost = inputCostPrice;
                      if (inputSellPrice !== null) newSell = inputSellPrice;
                      newQty = qty; // For 'adjustment', we usually set the exact quantity found
                  }
                  
                  return { ...p, qty: Math.max(0, newQty), costPrice: newCost, sellPrice: newSell };
              }
              return p;
          });

          const movement: StockMovement = {
              id: Date.now().toString(), productId: adjustingProduct.id, type, qty, date: new Date().toISOString(),
              userId: prev.currentUser!.id, userName: prev.currentUser!.name, observation: obs
          };
          return { ...prev, products: newProducts, movements: [...prev.movements, movement] };
      });

      setIsAdjustmentModalOpen(false);
      setAdjustingProduct(null);
      showToast('Estoque e custos atualizados!', 'success');
  };

  const handleSaveSupplier = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const supplierData: Supplier = {
          id: editingSupplier ? editingSupplier.id : Date.now().toString(),
          name: formData.get('name') as string,
          cnpj: formData.get('cnpj') as string,
          contactName: formData.get('contactName') as string,
          representativeName: formData.get('representativeName') as string,
          phone: formData.get('phone') as string,
          email: formData.get('email') as string,
          address: formData.get('address') as string,
      };

      setState(prev => ({
          ...prev,
          suppliers: editingSupplier 
            ? prev.suppliers.map(s => s.id === editingSupplier.id ? supplierData : s)
            : [...prev.suppliers, supplierData]
      }));
      setIsSupplierModalOpen(false);
      setEditingSupplier(null);
      showToast('Fornecedor salvo!', 'success');
  };

  // --- POS LOGIC ---
  const addToCart = (product: Product) => {
    if (product.qty <= 0) { showToast('Produto sem estoque!', 'error'); return; }
    setCart(prev => {
        const existing = prev.find(item => item.productId === product.id);
        if (existing) {
             if (existing.qty + 1 > product.qty) { showToast('Limite de estoque atingido.', 'warning'); return prev; }
             return prev.map(item => item.productId === product.id ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.unitPrice } : item);
        }
        return [...prev, { productId: product.id, productName: product.name, qty: 1, unitPrice: product.sellPrice, total: product.sellPrice }];
    });
    setPosSearch('');
  };

  const secureAction = (action: string, payload?: any) => {
      state.currentUser?.role === 'admin' ? performSecureAction(action, payload) : setShowPinModal({ action, payload });
  };

  const performSecureAction = (action: string, payload?: any) => {
      if (action === 'remove_item') setCart(prev => prev.filter(i => i.productId !== payload));
      if (action === 'cancel_sale') setCart([]);
      if (action === 'delete_user') setState(prev => ({...prev, users: prev.users.filter(u => u.id !== payload)}));
      if (action === 'add_user') setState(prev => ({...prev, users: [...prev.users, payload]}));
      if (action === 'change_pin') setState(prev => ({...prev, adminPin: payload}));
      if (action === 'reset_data') { localStorage.removeItem('MERCADO_FACIL_DB_V4'); window.location.reload(); }
      setShowPinModal(null);
      showToast('Ação autorizada!', 'success');
  };

  const handlePinSubmit = (pin: string) => pin === state.adminPin ? performSecureAction(showPinModal!.action, showPinModal!.payload) : showToast('Senha incorreta', 'error');

  const finalizeSale = () => {
      if (cart.length === 0) return;
      const total = cart.reduce((acc, item) => acc + item.total, 0);
      const newSale: Sale = {
          id: Date.now().toString(), items: cart, totalValue: total, paymentMethod, date: new Date().toISOString(), userId: state.currentUser!.id, userName: state.currentUser!.name
      };
      
      const newProducts = [...state.products];
      const newMovements = [...state.movements];
      cart.forEach(item => {
          const idx = newProducts.findIndex(p => p.id === item.productId);
          if (idx >= 0) {
              const updatedProduct = { ...newProducts[idx] };
              updatedProduct.qty = Math.max(0, updatedProduct.qty - item.qty);
              newProducts[idx] = updatedProduct;
              
              newMovements.push({
                  id: Date.now().toString() + Math.random(), productId: item.productId, type: 'sale', qty: item.qty, date: new Date().toISOString(), userId: state.currentUser!.id, userName: state.currentUser!.name
              });
          }
      });

      setState(prev => ({ ...prev, products: newProducts, movements: newMovements, sales: [...prev.sales, newSale] }));
      setLastSale(newSale); setCart([]); setPosSearch(''); showToast('Venda finalizada!', 'success');
  };

  // --- MENU ITEMS ---
  const navItems = useMemo(() => {
      const role = state.currentUser?.role;
      const items = [
          { id: 'dashboard', label: 'Visão Geral', icon: <LayoutDashboard size={20}/>, roles: ['admin', 'employee', 'cashier'] },
          { id: 'inventory', label: 'Estoque', icon: <Package size={20}/>, roles: ['admin', 'employee'] },
          { id: 'pos', label: 'Caixa / PDV', icon: <ShoppingCart size={20}/>, roles: ['admin', 'employee', 'cashier'] },
          { id: 'purchases', label: 'Compras', icon: <FileText size={20}/>, roles: ['admin', 'employee'] },
          { id: 'suppliers', label: 'Fornecedores', icon: <Truck size={20}/>, roles: ['admin', 'employee'] },
          { id: 'reports', label: 'Relatórios', icon: <BarChart2 size={20}/>, roles: ['admin'] },
          { id: 'settings', label: 'Configurações', icon: <Settings size={20}/>, roles: ['admin'] },
      ];
      return items.filter(i => i.roles.includes(role || ''));
  }, [state.currentUser]);


  // --- VIEWS ---

  const renderDashboard = () => {
    const lowStockCount = state.products.filter(p => p.qty <= p.minQty).length;
    const todaySales = state.sales.filter(s => new Date(s.date).toLocaleDateString() === new Date().toLocaleDateString())
        .reduce((acc, s) => acc + s.totalValue, 0);
    const salesGoal = 1000;
    const progress = Math.min((todaySales / salesGoal) * 100, 100);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <h1 className="text-2xl font-bold text-gray-800">Visão Geral</h1>
            
            {lowStockCount > 0 && <AlertBanner count={lowStockCount} onClick={() => { if(state.currentUser?.role !== 'cashier') { setActiveTab('inventory'); setSearchTerm(''); } }} />}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Vendas Hoje</p>
                        <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(todaySales)}</h3>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-full"><DollarSign size={24}/></div>
                </div>
                {state.currentUser?.role !== 'cashier' && (
                    <>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Estoque Total</p>
                            <h3 className="text-2xl font-bold text-gray-800">{state.products.reduce((acc, p) => acc + p.qty, 0)} itens</h3>
                        </div>
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-full"><Package size={24}/></div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Valor em Estoque</p>
                            <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(state.products.reduce((acc, p) => acc + (p.qty * p.costPrice), 0))}</h3>
                        </div>
                        <div className="p-3 bg-green-50 text-green-600 rounded-full"><TrendingUp size={24}/></div>
                    </div>
                    </>
                )}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Produtos Críticos</p>
                        <h3 className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>{lowStockCount}</h3>
                    </div>
                    <div className={`p-3 rounded-full ${lowStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}><AlertTriangle size={24}/></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-4">Meta de Vendas Diária</h3>
                    <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden mb-2">
                        <div className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-gray-500">
                        <span>{formatCurrency(todaySales)}</span>
                        <span>Meta: {formatCurrency(salesGoal)}</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center gap-3">
                    <button onClick={() => setActiveTab('pos')} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><ShoppingCart/> Abrir Caixa</button>
                    {state.currentUser?.role !== 'cashier' && <button onClick={() => { setPreSelectedSupplierId(''); setIsPurchaseModalOpen(true); }} className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 p-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><Truck size={18}/> Novo Pedido</button>}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-700">Vendas Recentes</h3>
                    {state.currentUser?.role === 'admin' && <button onClick={() => setActiveTab('reports')} className="text-blue-600 text-sm font-bold hover:underline">Ver todas</button>}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Hora</th><th className="p-3">Operador</th><th className="p-3 text-center">Itens</th><th className="p-3 text-right">Valor</th></tr></thead>
                        <tbody className="divide-y">
                            {state.sales.slice(-5).reverse().map(s => (
                                <tr key={s.id}>
                                    <td className="p-3 text-gray-600">{new Date(s.date).toLocaleTimeString()}</td>
                                    <td className="p-3 font-medium">{s.userName}</td>
                                    <td className="p-3 text-center">{s.items.reduce((a,b)=>a+b.qty,0)}</td>
                                    <td className="p-3 text-right font-bold text-green-600">{formatCurrency(s.totalValue)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {state.sales.length === 0 && <p className="text-center text-gray-400 py-4 italic">Nenhuma venda hoje.</p>}
                </div>
            </div>
        </div>
    );
  };

  const renderInventory = () => (
      <div className="space-y-6 animate-fade-in pb-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
             <div className="flex gap-2 w-full md:w-auto flex-1">
                 <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input type="text" placeholder="Buscar produto..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                 </div>
                 <div className="relative w-48 hidden md:block">
                     <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                     <select className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500 appearance-none" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                         <option value="">Todas Categorias</option>
                         {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                 </div>
             </div>
             <div className="flex gap-3 w-full md:w-auto">
                 <button onClick={async () => { setIsLoadingAi(true); const res = await generateInventoryAnalysis(state.products, state.movements, state.sales); setAiAnalysis(res); setIsLoadingAi(false); }} className="flex-1 md:flex-none bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-purple-700 shadow-sm transition-all active:scale-95">
                     <Sparkles size={18} /> {isLoadingAi ? '...' : 'IA Insights'}
                 </button>
                 {state.currentUser?.role !== 'cashier' && (
                     <button onClick={() => { setEditingProduct(null); setPreviewImage(''); setIsProductModalOpen(true); }} className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 shadow-sm transition-all active:scale-95">
                         <Plus size={18} /> Novo
                     </button>
                 )}
             </div>
          </div>
          {aiAnalysis && (
              <div className="bg-purple-50 p-6 rounded-xl border border-purple-200 relative animate-scale-in">
                  <button onClick={() => setAiAnalysis('')} className="absolute top-4 right-4 text-purple-400 hover:text-purple-600"><X size={18}/></button>
                  <div className="prose prose-purple text-sm text-gray-700 whitespace-pre-line leading-relaxed">{aiAnalysis}</div>
              </div>
          )}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-gray-50 border-b"><tr><th className="p-4 w-12">Img</th><th className="p-4">Produto</th><th className="p-4 text-center">Cat.</th><th className="p-4 text-center">Estoque</th><th className="p-4 text-right">Preço</th><th className="p-4 text-center">Ações</th></tr></thead>
                    <tbody className="divide-y">
                        {state.products.filter(p => (filterCategory ? p.category === filterCategory : true) && (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode.includes(searchTerm) || p.sku.includes(searchTerm))).map(p => {
                            const isZero = p.qty === 0;
                            const isLow = p.qty <= p.minQty;
                            return (
                                <tr key={p.id} className={`transition-colors ${isZero ? 'bg-red-50/50' : isLow ? 'bg-orange-50/50' : 'hover:bg-gray-50'}`}>
                                    <td className="p-4"><div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border">{p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <Package size={20} className="text-gray-400" />}</div></td>
                                    <td className="p-4">
                                        <div className={`font-bold flex items-center gap-2 ${isZero ? 'text-red-700' : isLow ? 'text-orange-700' : 'text-gray-800'}`}>{p.name} {isZero ? <span className="bg-red-100 text-red-600 text-[10px] px-2 rounded-full font-bold">ESGOTADO</span> : isLow ? <span className="bg-orange-100 text-orange-600 text-[10px] px-2 rounded-full font-bold">BAIXO</span> : null}</div>
                                        <div className="text-xs text-gray-500">SKU: {p.sku} | EAN: {p.barcode}</div>
                                    </td>
                                    <td className="p-4 text-center"><span className="px-2 py-1 bg-gray-100 border rounded text-xs text-gray-600">{p.category}</span></td>
                                    <td className="p-4 text-center font-bold">{p.qty} <span className="text-xs font-normal text-gray-500">{p.unit}</span></td>
                                    <td className="p-4 text-right font-medium">{formatCurrency(p.sellPrice)}</td>
                                    <td className="p-4 text-center flex justify-center gap-1">
                                        <button onClick={() => setViewingHistoryProduct(p)} className="text-gray-500 hover:bg-gray-100 p-2 rounded-lg" title="Histórico"><History size={18}/></button>
                                        <button onClick={() => { setAdjustingProduct(p); setAdjustmentType('in'); setIsAdjustmentModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg" title="Ajuste"><RefreshCcw size={18}/></button>
                                        {state.currentUser?.role !== 'cashier' && (
                                            <button onClick={() => { setEditingProduct(p); setPreviewImage(p.imageUrl || ''); setIsProductModalOpen(true); }} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg" title="Editar"><Edit size={18}/></button>
                                        )}
                                        {canDelete && (
                                            <button onClick={() => { if(window.confirm('Excluir?')) setState(prev => ({...prev, products: prev.products.filter(x => x.id !== p.id)})); }} className="text-red-500 hover:bg-red-50 p-2 rounded-lg" title="Excluir"><Trash2 size={18}/></button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
              </div>
          </div>
      </div>
  );

  const renderPOS = () => (
      <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6 animate-fade-in pb-4">
          <div className="flex-[2] flex flex-col gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border flex gap-3 items-center">
                  <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <form onSubmit={e => { e.preventDefault(); const p = state.products.find(x => x.barcode === posSearch || x.sku === posSearch || x.name.toLowerCase() === posSearch.toLowerCase()); if(p) addToCart(p); else showToast('Produto não encontrado', 'error'); }}>
                        <input ref={posInputRef} autoFocus type="text" placeholder="Escanear produto (EAN) ou digitar nome..." className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg outline-none" value={posSearch} onChange={e => setPosSearch(e.target.value)} />
                      </form>
                  </div>
                  <button onClick={() => setIsScannerOpen(true)} className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg shadow-sm" title="Abrir Câmera"><Camera size={24} /></button>
              </div>
              <div className="bg-white rounded-xl shadow-sm border flex-1 overflow-y-auto p-4 relative">
                  {cart.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                          <ShoppingCart size={64} className="mb-4 opacity-50"/>
                          <p>Carrinho vazio. Escaneie um produto.</p>
                      </div>
                  ) : (
                    <table className="w-full">
                        <thead className="text-left text-gray-500 text-sm border-b"><tr><th className="pb-2 pl-2">Produto</th><th className="pb-2 text-center">Qtd</th><th className="pb-2 text-right">Total</th><th className="pb-2"></th></tr></thead>
                        <tbody className="divide-y">
                            {cart.map((item, idx) => (
                                <tr key={idx} className="group hover:bg-gray-50">
                                    <td className="py-3 pl-2 font-medium text-gray-800">{item.productName}</td>
                                    <td className="py-3 text-center">{item.qty}</td>
                                    <td className="py-3 text-right font-bold text-gray-800">{formatCurrency(item.total)}</td>
                                    <td className="py-3 text-right"><button onClick={() => secureAction('remove_item', item.productId)} className="text-gray-300 hover:text-red-500 p-1"><X size={18} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  )}
              </div>
          </div>
          <div className="flex-1 bg-slate-900 text-white rounded-xl shadow-2xl p-6 flex flex-col justify-between">
              <div>
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-400"><CreditCard /> Caixa</h2>
                  <div className="space-y-4 mb-8">
                      <div className="flex justify-between items-end"><span className="text-slate-400 text-sm">Subtotal</span><span className="font-mono">{formatCurrency(cart.reduce((a, b) => a + b.total, 0))}</span></div>
                      <div className="flex justify-between text-4xl font-bold text-green-400 pt-6 border-t border-slate-700"><span>Total</span><span>{formatCurrency(cart.reduce((a, b) => a + b.total, 0))}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                      {[{ id: 'cash', label: 'Dinheiro', icon: <Banknote size={18}/> }, { id: 'pix', label: 'PIX', icon: <QrCode size={18}/> }, { id: 'credit', label: 'Crédito', icon: <CreditCard size={18}/> }, { id: 'debit', label: 'Débito', icon: <CreditCard size={18}/> }].map(m => (
                          <button key={m.id} onClick={() => setPaymentMethod(m.id as any)} className={`p-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all border ${paymentMethod === m.id ? 'bg-green-600 border-green-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>{m.icon} {m.label}</button>
                      ))}
                  </div>
              </div>
              <div className="space-y-3">
                  <button onClick={finalizeSale} disabled={cart.length === 0} className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all">FINALIZAR VENDA</button>
                  <button onClick={() => secureAction('cancel_sale')} disabled={cart.length === 0} className="w-full py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl font-medium disabled:opacity-50 transition-colors">Cancelar Venda</button>
              </div>
          </div>
      </div>
  );

  const renderSuppliers = () => (
      <div className="space-y-6 animate-fade-in pb-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-bold text-gray-800">Fornecedores</h2>
              <div className="flex gap-2 w-full md:w-auto">
                 <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input type="text" placeholder="Buscar fornecedor..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} />
                 </div>
                 <button onClick={() => { setEditingSupplier(null); setIsSupplierModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-blue-700 transition-colors shadow-sm"><Plus size={18} /> Novo</button>
              </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {state.suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || s.contactName.toLowerCase().includes(supplierSearch.toLowerCase())).map(s => (
                  <div key={s.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 transition-colors group relative flex flex-col">
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingSupplier(s); setIsSupplierModalOpen(true); }} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"><Edit size={16}/></button>
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">{s.name.charAt(0)}</div>
                          <div><h3 className="font-bold text-lg text-gray-800 leading-tight">{s.name}</h3><p className="text-xs text-gray-500">CNPJ: {s.cnpj}</p></div>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600 flex-1">
                          <p className="flex justify-between border-b border-gray-50 pb-1"><span>Contato:</span> <span className="font-medium text-gray-800">{s.contactName}</span></p>
                          <p className="flex justify-between border-b border-gray-50 pb-1"><span>Rep:</span> <span className="font-medium text-gray-800">{s.representativeName || '-'}</span></p>
                          <p className="flex justify-between border-b border-gray-50 pb-1"><span>Tel:</span> <span className="font-medium text-gray-800">{s.phone}</span></p>
                          <p className="truncate text-xs text-gray-400 pt-1"><span className="font-medium text-gray-500">End:</span> {s.address}</p>
                          <div className="pt-4 mt-2">
                              <p className="font-bold text-xs text-gray-500 mb-2 uppercase tracking-wide">Últimos Pedidos</p>
                              {state.orders.filter(o => o.supplierId === s.id).sort((a,b)=>new Date(b.dateCreated).getTime()-new Date(a.dateCreated).getTime()).slice(0, 3).map(o => (
                                  <div key={o.id} className="flex justify-between py-1 text-xs"><span>{formatDate(o.dateCreated).split(' ')[0]}</span><span className={`px-1.5 py-0.5 rounded font-bold ${o.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{o.status === 'received' ? 'Entregue' : 'Aberto'}</span></div>
                              ))}
                          </div>
                      </div>
                      <button onClick={() => openPurchaseForSupplier(s.id)} className="mt-4 w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"><Truck size={14}/> Novo Pedido</button>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderPurchases = () => {
    const [selectedSupplierId, setSelectedSupplierId] = useState(preSelectedSupplierId);
    const [orderItems, setOrderItems] = useState<{productId: string, qty: number, cost: number}[]>([]);

    useEffect(() => {
        setSelectedSupplierId(preSelectedSupplierId);
    }, [preSelectedSupplierId]);

    const createOrder = () => {
        if (!selectedSupplierId || orderItems.length === 0) return;
        
        // Validate items
        const invalidItems = orderItems.some(i => i.qty <= 0 || i.qty > 99999);
        if (invalidItems) {
            showToast('Existem itens com quantidades inválidas (zero, negativo ou excessivo).', 'error');
            return;
        }

        const newOrder: PurchaseOrder = {
            id: Date.now().toString(), supplierId: selectedSupplierId, status: 'open', dateCreated: new Date().toISOString(), items: orderItems
        };
        setState(prev => ({ ...prev, orders: [...prev.orders, newOrder] }));
        setIsPurchaseModalOpen(false);
        setPreSelectedSupplierId('');
        setOrderItems([]);
        showToast('Pedido de compra criado!', 'success');
    };

    const receiveOrder = (order: PurchaseOrder) => {
        if (window.confirm('Confirmar recebimento? Isso atualizará o estoque e custos.')) {
            setState(prev => {
                const updatedProducts = [...prev.products];
                const newMovements = [...prev.movements];
                order.items.forEach(item => {
                    const prodIdx = updatedProducts.findIndex(p => p.id === item.productId);
                    if (prodIdx >= 0) {
                        const p = updatedProducts[prodIdx];
                        // Weighted Average Cost Calculation (handles negative stock gracefully by assuming 0 base for cost)
                        const currentQty = Math.max(0, p.qty);
                        const totalValue = (currentQty * p.costPrice) + (item.qty * item.cost);
                        const totalQty = currentQty + item.qty;
                        const newCost = totalQty > 0 ? totalValue / totalQty : item.cost;
                        
                        updatedProducts[prodIdx] = { ...p, qty: p.qty + item.qty, costPrice: newCost };
                        newMovements.push({
                            id: Date.now().toString() + Math.random(), productId: p.id, type: 'in', qty: item.qty, date: new Date().toISOString(), userId: prev.currentUser!.id, userName: prev.currentUser!.name, observation: `Recebimento Pedido #${order.id}`
                        });
                    }
                });
                return { ...prev, products: updatedProducts, movements: newMovements, orders: prev.orders.map(o => o.id === order.id ? { ...o, status: 'received' as const } : o) };
            });
            showToast(`Estoque atualizado com sucesso! ${order.items.length} produtos processados.`, 'success');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Pedidos de Compra</h2>
                <button onClick={() => { setPreSelectedSupplierId(''); setIsPurchaseModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-blue-700 transition-colors shadow-sm"><Plus size={18} /> Novo Pedido</button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                 <table className="w-full text-left whitespace-nowrap">
                     <thead className="bg-gray-50 border-b text-gray-600 font-semibold text-sm"><tr><th className="p-4">Data</th><th className="p-4">Fornecedor</th><th className="p-4 text-center">Itens</th><th className="p-4 text-center">Status</th><th className="p-4 text-right">Total</th><th className="p-4"></th></tr></thead>
                     <tbody className="divide-y">
                         {state.orders.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum pedido registrado</td></tr> :
                         state.orders.sort((a,b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()).map(order => {
                             const supplier = state.suppliers.find(s => s.id === order.supplierId);
                             const total = order.items.reduce((acc, i) => acc + (i.qty * i.cost), 0);
                             return (
                                 <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                     <td className="p-4 text-gray-600">{formatDate(order.dateCreated)}</td>
                                     <td className="p-4 font-medium text-gray-800">{supplier?.name || 'Desconhecido'}</td>
                                     <td className="p-4 text-center"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-600">{order.items.length} itens</span></td>
                                     <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${order.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{order.status === 'received' ? 'Recebido' : 'Em Aberto'}</span></td>
                                     <td className="p-4 text-right font-mono">{formatCurrency(total)}</td>
                                     <td className="p-4 text-right">{order.status === 'open' && <button onClick={() => receiveOrder(order)} className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 font-medium shadow-sm transition-all active:scale-95">Confirmar</button>}</td>
                                 </tr>
                             )
                         })}
                     </tbody>
                 </table>
            </div>

            {isPurchaseModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-scale-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl"><h3 className="font-bold text-gray-800">Novo Pedido</h3><button onClick={() => setIsPurchaseModalOpen(false)}><X size={20}/></button></div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-6">
                            <div>
                                <label className="block text-sm font-bold mb-2 text-gray-600">Selecione o Fornecedor</label>
                                <select className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}>
                                    <option value="">Selecione...</option>
                                    {state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            {selectedSupplierId && (
                                <div className="border border-blue-100 p-5 rounded-lg bg-blue-50/50">
                                    <h4 className="font-bold mb-3 text-blue-800 flex items-center gap-2"><Package size={18}/> Produtos do Fornecedor</h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {state.products.filter(p => p.supplierId === selectedSupplierId).map(p => (
                                            <div key={p.id} className="flex justify-between items-center bg-white p-3 border border-blue-100 rounded-lg shadow-sm">
                                                <span className="font-medium text-gray-700">{p.name}</span>
                                                <button onClick={() => setOrderItems(prev => [...prev, { productId: p.id, qty: 10, cost: p.costPrice }])} className="text-blue-600 text-sm font-bold hover:bg-blue-50 px-3 py-1 rounded">+ Add</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {orderItems.length > 0 && (
                                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                                    {orderItems.map((item, idx) => {
                                        const p = state.products.find(x => x.id === item.productId);
                                        return (
                                            <div key={idx} className="flex gap-3 items-center bg-white p-2 rounded border shadow-sm">
                                                <span className="flex-1 text-sm font-medium">{p?.name}</span>
                                                <input type="number" min="1" className="w-20 border p-1 rounded text-sm text-center font-bold focus:ring-1 focus:ring-blue-500" value={item.qty} onChange={e => { const val = Math.max(1, Number(e.target.value)); const n = [...orderItems]; n[idx].qty = val; setOrderItems(n); }} />
                                                <input type="number" className="w-24 border p-1 rounded text-sm text-center" value={item.cost} onChange={e => { const n = [...orderItems]; n[idx].cost = Number(e.target.value); setOrderItems(n); }} />
                                                <button onClick={() => setOrderItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-1"><X size={18}/></button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
                            <button onClick={createOrder} disabled={orderItems.length === 0} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold disabled:opacity-50 hover:bg-blue-700 shadow-md">Confirmar Pedido</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  };

  const renderReports = () => {
    const exportInventoryCSV = () => {
        const headers = ['Produto', 'Categoria', 'Estoque', 'Custo', 'Venda', 'Total Custo', 'Total Venda'];
        const rows = state.products.map(p => [p.name, p.category, p.qty, p.costPrice, p.sellPrice, (p.qty * p.costPrice), (p.qty * p.sellPrice)]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const link = document.createElement("a");
        link.href = encodeURI(csvContent);
        link.download = "inventario.csv";
        document.body.appendChild(link);
        link.click();
    };

    const paymentData = useMemo(() => {
        const map = { cash: 0, credit: 0, debit: 0, pix: 0 };
        state.sales.forEach(s => map[s.paymentMethod] += s.totalValue);
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [state.sales]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    // Sales Trend (Last 7 Days)
    const trendData = useMemo(() => {
        const days = Array.from({length: 7}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
        });
        return days.map(date => ({
            date,
            value: state.sales.filter(s => new Date(s.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) === date).reduce((a, b) => a + b.totalValue, 0)
        }));
    }, [state.sales]);

    // Top Selling Products
    const topProductsData = useMemo(() => {
        const productSales: {[key: string]: number} = {};
        state.sales.forEach(s => {
            s.items.forEach(item => {
                productSales[item.productName] = (productSales[item.productName] || 0) + item.qty;
            });
        });
        return Object.entries(productSales)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, value]) => ({ name, value }));
    }, [state.sales]);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <h2 className="text-xl font-bold text-gray-800">Relatórios Gerenciais</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-80 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col relative min-w-0">
                    <h3 className="font-bold text-gray-700 mb-4">Evolução de Vendas (7 Dias)</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" fontSize={12} />
                                <YAxis fontSize={12} />
                                <RechartsTooltip />
                                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 8}} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="h-80 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col relative min-w-0">
                    <h3 className="font-bold text-gray-700 mb-4">Vendas por Pagamento</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value">
                                    {paymentData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <RechartsTooltip />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="h-80 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col relative min-w-0 lg:col-span-2">
                    <h3 className="font-bold text-gray-700 mb-4">Top 5 Produtos Mais Vendidos</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topProductsData} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                                <XAxis type="number" />
                                <YAxis type="category" dataKey="name" width={150} tick={{fontSize: 12}} />
                                <RechartsTooltip />
                                <Bar dataKey="value" fill="#8884d8" name="Quantidade">
                                    {topProductsData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-700 text-lg flex items-center gap-2"><FileText size={20}/> Inventário Detalhado</h3>
                    <button onClick={exportInventoryCSV} className="flex items-center gap-2 text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-4 py-2 rounded-lg font-bold transition-colors">
                        <FileSpreadsheet size={18}/> Exportar CSV
                    </button>
                </div>
                <div className="overflow-x-auto max-h-96 custom-scrollbar border rounded-lg">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                            <tr>
                                <th className="p-3 border-b">Produto</th>
                                <th className="p-3 border-b text-center">Qtd</th>
                                <th className="p-3 border-b text-right">Custo Unit.</th>
                                <th className="p-3 border-b text-right">Venda Unit.</th>
                                <th className="p-3 border-b text-right font-bold">Total Custo</th>
                                <th className="p-3 border-b text-right font-bold">Total Venda</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {state.products.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="p-3">{p.name}</td>
                                    <td className={`p-3 text-center font-bold ${p.qty <= p.minQty ? 'text-red-600' : ''}`}>{p.qty}</td>
                                    <td className="p-3 text-right">{formatCurrency(p.costPrice)}</td>
                                    <td className="p-3 text-right">{formatCurrency(p.sellPrice)}</td>
                                    <td className="p-3 text-right font-mono text-gray-600">{formatCurrency(p.qty * p.costPrice)}</td>
                                    <td className="p-3 text-right font-mono text-blue-600">{formatCurrency(p.qty * p.sellPrice)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  const renderSettings = () => {
      const [newUser, setNewUser] = useState({ name: '', role: 'employee' });
      const [newPin, setNewPin] = useState('');
      
      const addUser = () => {
          if(!newUser.name) return;
          secureAction('add_user', { id: Date.now().toString(), name: newUser.name, role: newUser.role });
          setNewUser({ name: '', role: 'employee' });
      };

      const handleBackup = () => {
          const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
          a.click();
      };

      const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const data = JSON.parse(event.target?.result as string);
                  if (data.users && data.products) { setState(data); showToast('Dados restaurados!', 'success'); }
              } catch (err) { showToast('Erro ao ler arquivo', 'error'); }
          };
          reader.readAsDataURL(file);
      };

      return (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 pb-4 border-b"><ShieldAlert size={20} className="text-red-500"/> Segurança</h3>
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                      <div className="flex-1 w-full"><label className="text-xs font-bold text-gray-500 mb-1 block uppercase">Novo PIN do Gerente (4 dígitos)</label><input type="password" placeholder="****" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" value={newPin} onChange={e => setNewPin(e.target.value)} maxLength={4} /></div>
                      <button onClick={() => { if(newPin.length === 4) secureAction('change_pin', newPin); else showToast('O PIN deve ter 4 dígitos', 'warning'); }} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-bold transition-colors w-full md:w-auto">Alterar Senha</button>
                  </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 pb-4 border-b"><UserIcon size={20} className="text-blue-500"/> Usuários</h3>
                  <div className="space-y-6">
                      <div className="flex flex-col md:flex-row gap-3 items-end bg-gray-50 p-5 rounded-xl border border-gray-200">
                          <div className="flex-1 w-full"><label className="text-xs font-bold text-gray-500 mb-1 block uppercase">Nome</label><input className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="Ex: Maria" /></div>
                          <div className="w-full md:w-48"><label className="text-xs font-bold text-gray-500 mb-1 block uppercase">Função</label><select className="w-full border p-2.5 rounded-lg bg-white outline-none" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}><option value="admin">Administrador</option><option value="employee">Funcionário</option><option value="cashier">Caixa</option></select></div>
                          <button onClick={addUser} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 w-full md:w-auto">Adicionar</button>
                      </div>
                      <div className="divide-y border rounded-xl overflow-hidden">
                          {state.users.map(u => (
                              <div key={u.id} className="p-4 flex justify-between items-center bg-white hover:bg-gray-50 transition-colors">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${u.role === 'admin' ? 'bg-purple-500' : u.role === 'cashier' ? 'bg-green-500' : 'bg-blue-500'}`}>{u.name.charAt(0)}</div>
                                      <div><p className="font-bold text-gray-800">{u.name}</p><p className="text-[10px] text-gray-500 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-0.5">{u.role === 'employee' ? 'Funcionário' : u.role === 'cashier' ? 'Caixa' : 'Administrador'}</p></div>
                                  </div>
                                  {u.id !== state.currentUser?.id && <button onClick={() => secureAction('delete_user', u.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18}/></button>}
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 pb-4 border-b"><Archive size={20} className="text-green-500"/> Dados</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <button onClick={handleBackup} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-blue-200 rounded-xl hover:bg-blue-50 transition-all text-blue-500 hover:text-blue-700"><Download size={32} className="mb-2"/><span className="font-bold">Baixar Backup</span></button>
                      <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-green-200 rounded-xl hover:bg-green-50 transition-all text-green-500 hover:text-green-700 cursor-pointer"><Upload size={32} className="mb-2"/><span className="font-bold">Restaurar</span><input type="file" accept=".json" className="hidden" onChange={handleRestore} /></label>
                      <button onClick={() => secureAction('reset_data')} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-red-200 rounded-xl hover:bg-red-50 transition-all text-red-500 hover:text-red-700"><RefreshCw size={32} className="mb-2"/><span className="font-bold">Resetar Tudo</span></button>
                  </div>
              </div>
          </div>
      );
  };

  if (!state.currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-inter">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-4 border-blue-600 animate-fade-in">
          <div className="flex justify-center mb-6"><div className="bg-blue-600 p-4 rounded-xl shadow-lg transform -rotate-3"><Package size={48} className="text-white" /></div></div>
          <h1 className="text-3xl font-bold text-center mb-10 text-gray-800 tracking-tight">Mercado Fácil</h1>
          <div className="space-y-4">
            {state.users.map(user => (
              <button key={user.id} onClick={() => handleLogin(user)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md transition-transform group-hover:scale-110 ${user.role === 'admin' ? 'bg-purple-500' : user.role === 'cashier' ? 'bg-green-500' : 'bg-blue-500'}`}>{user.name.charAt(0)}</div>
                <div className="text-left flex-1"><div className="font-bold text-gray-800 text-lg group-hover:text-blue-700 transition-colors">{user.name}</div><div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{user.role === 'employee' ? 'Funcionário' : user.role === 'cashier' ? 'Caixa' : 'Administrador'}</div></div>
                <ChevronRight className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-inter text-gray-900">
      <aside className={`bg-slate-900 text-slate-300 transition-all duration-300 fixed h-full z-20 flex flex-col shadow-2xl ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-20 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950">
          {isSidebarOpen && <span className="font-bold text-xl text-white tracking-tight flex items-center gap-2"><Package className="text-blue-500"/> Mercado<span className="text-blue-500">Fácil</span></span>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><Menu size={20}/></button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-105 origin-left' : 'hover:bg-slate-800 hover:text-white'}`}>
              <span className={activeTab === item.id ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 bg-slate-950">
           <div className={`flex items-center gap-3 ${!isSidebarOpen && 'justify-center'}`}>
               <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg border-2 border-slate-700 ${state.currentUser.role === 'admin' ? 'bg-purple-500' : state.currentUser.role === 'cashier' ? 'bg-green-500' : 'bg-blue-500'}`}>{state.currentUser.name.charAt(0)}</div>
               {isSidebarOpen && <div className="flex-1 overflow-hidden"><p className="text-sm font-bold text-white truncate">{state.currentUser.name}</p><button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 mt-1"><LogOut size={10}/> Sair</button></div>}
           </div>
        </div>
      </aside>

      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'} p-8 min-w-[768px]`}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'inventory' && renderInventory()}
        {activeTab === 'pos' && renderPOS()}
        {activeTab === 'suppliers' && renderSuppliers()}
        {activeTab === 'purchases' && renderPurchases()}
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'settings' && renderSettings()}
      </main>

      {/* Global Modals */}
      {isProductModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
                  <form onSubmit={handleSaveProduct} className="p-8">
                      <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingProduct ? 'Editar' : 'Novo'} Produto</h2>
                      <div className="grid grid-cols-2 gap-6">
                          <div className="col-span-2">
                              <label className="block text-sm font-bold mb-2 text-gray-600">Nome do Produto</label>
                              <input name="name" defaultValue={editingProduct?.name} required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Arroz Branco 5kg" />
                          </div>
                          
                          <div className="col-span-2 grid grid-cols-[100px_1fr] gap-4 items-center border p-4 rounded-lg bg-gray-50">
                              <div className="w-24 h-24 bg-white border rounded-lg flex items-center justify-center overflow-hidden relative group">
                                   {previewImage ? (
                                      <img src={previewImage} className="w-full h-full object-cover" />
                                   ) : (
                                      <ImageIcon className="text-gray-300"/>
                                   )}
                              </div>
                              <div>
                                  <label className="block text-sm font-bold mb-1 text-gray-600">Imagem do Produto</label>
                                  <input 
                                    type="file" 
                                    name="imageFile" 
                                    accept="image/*" 
                                    onChange={handleImageChange}
                                    className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
                                  />
                              </div>
                          </div>

                          <div>
                              <label className="block text-sm font-bold mb-2 text-gray-600">Categoria</label>
                              <select name="category" defaultValue={editingProduct?.category} className="w-full border p-3 rounded-lg bg-white outline-none">
                                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-bold mb-2 text-gray-600">Unidade</label>
                              <select name="unit" defaultValue={editingProduct?.unit} className="w-full border p-3 rounded-lg bg-white outline-none">
                                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                          </div>
                          <div><label className="block text-sm font-bold mb-2 text-gray-600">SKU</label><input name="sku" defaultValue={editingProduct?.sku} required className="w-full border p-3 rounded-lg" /></div>
                          <div><label className="block text-sm font-bold mb-2 text-gray-600">EAN</label><input name="barcode" defaultValue={editingProduct?.barcode} className="w-full border p-3 rounded-lg" placeholder="Gerar auto se vazio" /></div>
                          <div><label className="block text-sm font-bold mb-2 text-gray-600">Preço Custo (R$)</label><input name="costPrice" type="number" step="0.01" min="0" defaultValue={editingProduct?.costPrice} required disabled={!canEditPrices} className="w-full border p-3 rounded-lg disabled:bg-gray-100 disabled:text-gray-500" /></div>
                          <div><label className="block text-sm font-bold mb-2 text-gray-600">Preço Venda (R$)</label><input name="sellPrice" type="number" step="0.01" min="0" defaultValue={editingProduct?.sellPrice} required disabled={!canEditPrices} className="w-full border p-3 rounded-lg disabled:bg-gray-100 disabled:text-gray-500" /></div>
                          {!editingProduct && (
                              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                  <label className="block text-sm font-bold mb-2 text-blue-800">Estoque Inicial</label>
                                  <input name="qty" type="number" min="0" defaultValue={0} className="w-full border border-blue-200 p-3 rounded-lg" />
                              </div>
                          )}
                          <div><label className="block text-sm font-bold mb-2 text-gray-600">Mínimo (Alerta)</label><input name="minQty" type="number" min="0" defaultValue={editingProduct?.minQty || 5} required className="w-full border p-3 rounded-lg" /></div>
                          <div className="col-span-2">
                              <label className="block text-sm font-bold mb-2 text-gray-600">Fornecedor Principal</label>
                              <select name="supplierId" defaultValue={editingProduct?.supplierId || state.suppliers[0]?.id} className="w-full border p-3 rounded-lg bg-white outline-none">
                                  {state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                          </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
                          <button type="button" onClick={() => setIsProductModalOpen(false)} className="px-6 py-3 bg-gray-100 rounded-lg font-medium text-gray-600">Cancelar</button>
                          <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-md">Salvar Produto</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {isSupplierModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg animate-scale-in">
                  <form onSubmit={handleSaveSupplier} className="p-8 space-y-5">
                      <h2 className="text-2xl font-bold text-gray-800">{editingSupplier ? 'Editar' : 'Novo'} Fornecedor</h2>
                      <div><label className="text-xs font-bold text-gray-500 uppercase">Empresa</label><input name="name" defaultValue={editingSupplier?.name} required className="w-full border p-3 rounded-lg mt-1" /></div>
                      <div><label className="text-xs font-bold text-gray-500 uppercase">CNPJ</label><input name="cnpj" defaultValue={editingSupplier?.cnpj} required className="w-full border p-3 rounded-lg mt-1" /></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-xs font-bold text-gray-500 uppercase">Contato</label><input name="contactName" defaultValue={editingSupplier?.contactName} required className="w-full border p-3 rounded-lg mt-1" /></div>
                          <div><label className="text-xs font-bold text-gray-500 uppercase">Rep.</label><input name="representativeName" defaultValue={editingSupplier?.representativeName} className="w-full border p-3 rounded-lg mt-1" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-xs font-bold text-gray-500 uppercase">Tel</label><input name="phone" defaultValue={editingSupplier?.phone} required className="w-full border p-3 rounded-lg mt-1" /></div>
                          <div><label className="text-xs font-bold text-gray-500 uppercase">Email</label><input name="email" defaultValue={editingSupplier?.email} type="email" required className="w-full border p-3 rounded-lg mt-1" /></div>
                      </div>
                      <div><label className="text-xs font-bold text-gray-500 uppercase">Endereço</label><input name="address" defaultValue={editingSupplier?.address} className="w-full border p-3 rounded-lg mt-1" /></div>
                      <div className="flex justify-end gap-3 pt-4">
                          <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="px-6 py-2 bg-gray-100 rounded-lg text-gray-600 font-medium">Cancelar</button>
                          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Salvar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {isAdjustmentModalOpen && adjustingProduct && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-96 p-6 animate-scale-in">
                  <h3 className="font-bold text-lg mb-4 text-gray-800">Ajuste de Estoque</h3>
                  <p className="text-sm text-gray-500 mb-4 bg-gray-50 p-2 rounded">Produto: <strong>{adjustingProduct.name}</strong> <br/> Atual: {adjustingProduct.qty} {adjustingProduct.unit}</p>
                  <form onSubmit={handleStockAdjustment}>
                      <div className="mb-4">
                          <label className="block text-sm font-bold mb-2 text-gray-600">Tipo</label>
                          <div className="grid grid-cols-3 gap-2">
                              <label className="border rounded-lg p-2 text-center cursor-pointer hover:bg-gray-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500">
                                  <input type="radio" name="type" value="in" className="hidden" checked={adjustmentType === 'in'} onChange={() => setAdjustmentType('in')} />
                                  <span className="text-sm font-bold">Entrada</span>
                              </label>
                              <label className="border rounded-lg p-2 text-center cursor-pointer hover:bg-gray-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500">
                                  <input type="radio" name="type" value="out" className="hidden" checked={adjustmentType === 'out'} onChange={() => setAdjustmentType('out')} />
                                  <span className="text-sm font-bold">Saída</span>
                              </label>
                              <label className="border rounded-lg p-2 text-center cursor-pointer hover:bg-gray-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500">
                                  <input type="radio" name="type" value="adjustment" className="hidden" checked={adjustmentType === 'adjustment'} onChange={() => setAdjustmentType('adjustment')} />
                                  <span className="text-sm font-bold">Ajuste</span>
                              </label>
                          </div>
                      </div>
                      
                      <div className="mb-4"><label className="block text-sm font-bold mb-2 text-gray-600">Quantidade</label><input name="qty" type="number" min="1" required className="w-full border p-3 rounded-lg text-lg font-bold text-center" autoFocus /></div>
                      
                      {(adjustmentType === 'in' || adjustmentType === 'adjustment') && (
                          <div className="grid grid-cols-2 gap-3 mb-4 animate-fade-in">
                              <div><label className="block text-xs font-bold mb-1 text-gray-500">Novo Custo (Unit.)</label><input name="costPrice" type="number" step="0.01" min="0" placeholder={adjustingProduct.costPrice.toString()} className="w-full border p-2 rounded-lg" /></div>
                              <div><label className="block text-xs font-bold mb-1 text-gray-500">Novo Venda (Unit.)</label><input name="sellPrice" type="number" step="0.01" min="0" placeholder={adjustingProduct.sellPrice.toString()} className="w-full border p-2 rounded-lg" /></div>
                          </div>
                      )}

                      <div className="mb-6"><label className="block text-sm font-bold mb-2 text-gray-600">Motivo</label><input name="obs" placeholder="Ex: Inventário, Perda..." className="w-full border p-3 rounded-lg" required /></div>
                      <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsAdjustmentModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-gray-600 font-medium">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Confirmar</button></div>
                  </form>
              </div>
          </div>
      )}
      
      {viewingHistoryProduct && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[70vh] flex flex-col animate-scale-in">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl"><div><h3 className="font-bold text-gray-800">Histórico</h3><p className="text-sm text-gray-500">{viewingHistoryProduct.name}</p></div><button onClick={() => setViewingHistoryProduct(null)}><X size={20}/></button></div>
                  <div className="flex-1 overflow-y-auto p-0">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 sticky top-0 text-gray-500"><tr><th className="p-4">Data</th><th className="p-4">Tipo</th><th className="p-4 text-center">Qtd</th><th className="p-4">Obs</th><th className="p-4 text-right">Usuário</th></tr></thead>
                          <tbody className="divide-y">
                              {state.movements.filter(m => m.productId === viewingHistoryProduct.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(m => (
                                  <tr key={m.id} className="hover:bg-gray-50">
                                      <td className="p-4 text-gray-600">{formatDate(m.date)}</td>
                                      <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${m.type === 'in' ? 'bg-green-100 text-green-700' : m.type === 'out' || m.type === 'sale' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{m.type === 'in' ? 'Entrada' : m.type === 'sale' ? 'Venda' : m.type === 'out' ? 'Saída' : 'Ajuste'}</span></td>
                                      <td className="p-4 text-center font-bold text-gray-800">{m.qty}</td>
                                      <td className="p-4 text-gray-500 italic truncate max-w-[150px]">{m.observation || (m.type === 'sale' ? 'Venda PDV' : '-')}</td>
                                      <td className="p-4 text-right text-gray-600">{m.userName.split(' ')[0]}</td>
                                  </tr>
                              ))}
                              {state.movements.filter(m => m.productId === viewingHistoryProduct.id).length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhuma movimentação</td></tr>}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {isScannerOpen && <CameraScanner onScan={(code) => { 
          const p = state.products.find(x => x.barcode === code); 
          if(p) { addToCart(p); showToast(`Adicionado: ${p.name}`, 'success'); } else { showToast(`Código ${code} não encontrado`, 'warning'); }
      }} onClose={() => setIsScannerOpen(false)} />}
      
      {lastSale && <ReceiptModal sale={lastSale} onClose={() => setLastSale(null)} />}
      {showPinModal && <PinModal onSubmit={handlePinSubmit} onClose={() => setShowPinModal(null)} />}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}