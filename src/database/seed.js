// Dados iniciais de demonstração.
// Usa os próprios services, então passa pelas mesmas regras de negócio da API.
// É idempotente: se o usuário de demonstração já existir, não faz nada.

const DEMO_PASSWORD = "easyfood123";

const DEMO_USERS = {
  owner: { name: "Dono Demo", email: "dono@easyfood.com", password: DEMO_PASSWORD },
  customer: { name: "Cliente Demo", email: "cliente@easyfood.com", password: DEMO_PASSWORD }
};

const RESTAURANTS = [
  {
    name: "Forno da Vila",
    category: "Pizza",
    description: "Pizzas de fermentação natural assadas em forno a lenha.",
    rating: 4.8,
    deliveryFee: 6.9,
    menu: [
      { name: "Pizza Margherita", category: "Pizzas", description: "Molho de tomate, muçarela e manjericão", price: 54.9 },
      { name: "Pizza Calabresa", category: "Pizzas", description: "Calabresa artesanal e cebola roxa", price: 52.9 },
      { name: "Pizza Quatro Queijos", category: "Pizzas", description: "Muçarela, gorgonzola, parmesão e catupiry", price: 59.9 },
      { name: "Refrigerante Lata", category: "Bebidas", description: "350 ml", price: 6.5 }
    ]
  },
  {
    name: "Brasa Burger",
    category: "Hambúrguer",
    description: "Burgers smash com blend da casa.",
    rating: 4.6,
    deliveryFee: 5,
    menu: [
      { name: "Smash Clássico", category: "Burgers", description: "Dois smash de 80 g, cheddar e picles", price: 32.9 },
      { name: "Bacon Duplo", category: "Burgers", description: "Dois smash, bacon crocante e maionese da casa", price: 38.9 },
      { name: "Batata Rústica", category: "Acompanhamentos", description: "Porção individual com páprica", price: 16.9 }
    ]
  },
  {
    name: "Sakura Temaki",
    category: "Japonesa",
    description: "Temakis e combinados preparados na hora.",
    rating: 4.9,
    deliveryFee: 8.5,
    menu: [
      { name: "Temaki Salmão", category: "Temakis", description: "Salmão, cream cheese e cebolinha", price: 34.9 },
      { name: "Combinado 20 peças", category: "Combinados", description: "Sashimi, uramaki e hossomaki", price: 79.9 },
      { name: "Hot Roll", category: "Combinados", description: "8 unidades", price: 29.9 }
    ]
  },
  {
    name: "Tempero de Casa",
    category: "Brasileira",
    description: "Marmitas caseiras com o sabor de comida de mãe.",
    rating: 4.7,
    deliveryFee: 4,
    menu: [
      { name: "Feijoada Individual", category: "Pratos", description: "Acompanha arroz, couve e farofa", price: 36.9 },
      { name: "Frango Grelhado", category: "Pratos", description: "Arroz, feijão, salada e fritas", price: 27.9 },
      { name: "Pudim de Leite", category: "Sobremesas", description: "Fatia", price: 9.9 }
    ]
  },
  {
    name: "Verde Bowl",
    category: "Saudável",
    description: "Bowls e saladas montados com ingredientes frescos.",
    rating: 4.5,
    deliveryFee: 0,
    menu: [
      { name: "Bowl de Frango", category: "Bowls", description: "Quinoa, frango, abacate e legumes", price: 34.5 },
      { name: "Salada Caesar", category: "Saladas", description: "Alface romana, parmesão e croutons", price: 28 },
      { name: "Suco Verde", category: "Bebidas", description: "Couve, limão, gengibre e maçã", price: 12 }
    ]
  }
];

async function seed({ services, repositories, log = console.log }) {
  const { authService, restaurantService, menuService } = services;

  if (await repositories.users.findByEmail(DEMO_USERS.owner.email)) {
    log("Seed: dados de demonstração já existem, nada a fazer.");
    return;
  }

  const owner = await authService.register(DEMO_USERS.owner);
  await authService.register(DEMO_USERS.customer);

  for (const { menu, ...restaurantData } of RESTAURANTS) {
    const restaurant = await restaurantService.create(owner.id, restaurantData);
    for (const item of menu) {
      await menuService.create(restaurant.id, owner.id, { ...item, available: true });
    }
  }

  log(`Seed: ${RESTAURANTS.length} restaurantes criados.`);
  log(`Seed: logins de demonstração -> ${DEMO_USERS.owner.email} / ${DEMO_USERS.customer.email} (senha: ${DEMO_PASSWORD})`);
}

module.exports = { seed, DEMO_USERS };
