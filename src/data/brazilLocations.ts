export interface CountryOption {
  name: string;
  regionCode: string;
}

export interface StateOption {
  uf: string;
  name: string;
}

export const COUNTRIES: CountryOption[] = [
  { name: 'Brasil', regionCode: 'BR' },
  { name: 'Portugal', regionCode: 'PT' },
  { name: 'Estados Unidos', regionCode: 'US' },
  { name: 'Argentina', regionCode: 'AR' },
  { name: 'Chile', regionCode: 'CL' },
  { name: 'Uruguai', regionCode: 'UY' },
];

// Todos os 26 estados brasileiros + Distrito Federal (27 unidades federativas)
export const BRAZIL_STATES: StateOption[] = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
];

export const BUSINESS_SEGMENTS: string[] = [
  'Clínica Odontológica',
  'Restaurante',
  'Oficina Mecânica',
  'Salão de Beleza e Barbearia',
  'Academia e Studio Fitness',
  'Escritório de Advocacia',
  'Contabilidade',
  'Imobiliária',
  'Pet Shop e Clínica Veterinária',
  'Clínica Médica e Estética',
  'Loja de Móveis e Planejados',
  'Construtora e Reformas',
  'Pizzaria e Hamburgueria',
  'Padaria e Confeitaria',
  'Autopeças',
  'Corretora de Seguros',
];
