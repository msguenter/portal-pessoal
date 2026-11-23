export default function Dashboard() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-slate-500 text-lg">Bem-vindo ao seu Portal Pessoal.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Finanças', status: 'Em breve', color: 'bg-green-100 text-green-700' },
          { title: 'Saúde', status: 'Em breve', color: 'bg-red-100 text-red-700' },
          { title: 'Viagens', status: 'Em breve', color: 'bg-blue-100 text-blue-700' },
          { title: 'Planos', status: 'Em breve', color: 'bg-purple-100 text-purple-700' },
        ].map((module) => (
          <div key={module.title} className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold mb-2">{module.title}</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${module.color}`}>
              {module.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
