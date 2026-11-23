'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Wallet, 
  HeartPulse, 
  Plane, 
  Target, 
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';

const menuItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Finanças', href: '/financas', icon: Wallet },
  { name: 'Saúde', href: '/saude', icon: HeartPulse },
  { name: 'Viagens', href: '/viagens', icon: Plane },
  { name: 'Planos', href: '/planos', icon: Target },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <button 
        className="fixed top-4 left-4 z-50 p-2 bg-slate-800 text-white rounded-md md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transition-transform duration-300 transform
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:inset-0
      `}>
        <div className="flex flex-col h-full p-4">
          <div className="mb-8 px-2">
            <h1 className="text-2xl font-bold text-blue-400">Portal Pessoal</h1>
          </div>

          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'hover:bg-slate-800 text-slate-300 hover:text-white'}
                  `}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-800 px-2">
            <p className="text-xs text-slate-500">v0.1.0-dev</p>
          </div>
        </div>
      </aside>
    </>
  );
}
