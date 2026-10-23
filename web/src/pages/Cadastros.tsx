import { useState } from 'react'
import Produtos from './Produtos'
import Categorias from './Categorias'
import Embalagens from './Embalagens'
import Fornecedores from './Fornecedores'
import Filiais from './Filiais'
import Tabs from '../components/ui/Tabs'
import { ArchiveIcon, BoxIcon, BuildingIcon, TagIcon, UsersIcon } from '../components/icons'

type Tab = 'produtos' | 'filiais' | 'fornecedores' | 'categorias' | 'embalagens'

export default function Cadastros() {
  const [tab, setTab] = useState<Tab>('produtos')

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold text-gray-900">Cadastros</h1>

      <Tabs
        variant="underline"
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'produtos', label: 'Produtos', icon: BoxIcon },
          { value: 'filiais', label: 'Filiais', icon: UsersIcon },
          { value: 'fornecedores', label: 'Fornecedores', icon: BuildingIcon },
          { value: 'categorias', label: 'Categorias', icon: TagIcon },
          { value: 'embalagens', label: 'Embalagens', icon: ArchiveIcon },
        ]}
      />

      {tab === 'produtos' && <Produtos hideTitle />}
      {tab === 'filiais' && <Filiais />}
      {tab === 'fornecedores' && <Fornecedores hideTitle />}
      {tab === 'categorias' && <Categorias hideTitle />}
      {tab === 'embalagens' && <Embalagens hideTitle />}
    </div>
  )
}
