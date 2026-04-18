export const MOCK_CV = {
  personal_info: {
    name: "Marie Dupont",
    email: "marie.dupont@example.com",
    phone: "+33 6 12 34 56 78",
    location: "Paris, France",
    title: "Senior UX Designer",
    summary: "Senior UX Designer avec 10 ans d'expérience en design système, recherche utilisateur et prototypage Figma. Spécialisée en design d'interfaces B2B SaaS.",
    linkedin: "linkedin.com/in/marie-dupont",
  },
  experience: [
    {
      company: "TechCorp",
      position: "Senior UX Designer",
      location: "Paris",
      start_date: "2021-01",
      current: true,
      intro: "Lead designer pour les produits B2B SaaS de la suite enterprise.",
      description: [
        "Conçu et livré 3 modules majeurs utilisés par 50 000+ utilisateurs",
        "Établi le design system partagé entre 4 équipes produit",
        "Conduit 40+ sessions de recherche utilisateur avec analyse qualitative",
        "Réduit le taux d'abandon de 34% via optimisation des formulaires d'onboarding",
      ],
      kpi: "NPS produit passé de 32 à 67 en 18 mois",
      displayMode: "extended",
    },
    {
      company: "StartupXY",
      position: "UX Designer",
      location: "Lyon",
      start_date: "2018-03",
      end_date: "2020-12",
      intro: "Designer produit pour une fintech B2C (150k utilisateurs).",
      description: [
        "Redesign complet de l'app mobile (iOS/Android) en 6 mois",
        "Collaboration avec l'équipe de 5 développeurs React Native",
      ],
      displayMode: "normal",
    },
  ],
  education: [
    {
      school: "École de Design de Paris",
      degree: "Master Design Interaction",
      field: "UX/UI Design",
      start_date: "2016",
      end_date: "2018",
    },
  ],
  skills: [
    {
      category: "Outils Design",
      items: ["Figma", "Sketch", "Adobe XD", "Principle"],
      displayMode: "normal",
    },
    {
      category: "Méthodes",
      items: ["Design Thinking", "Jobs-to-be-Done", "Tests utilisateurs", "Design Sprint"],
      displayMode: "normal",
    },
    {
      category: "Technique",
      items: ["HTML/CSS", "React (notions)", "Storybook", "Zeroheight"],
      displayMode: "normal",
    },
  ],
  languages: [
    { name: "Français", proficiency: "Natif" },
    { name: "Anglais", proficiency: "Courant (C1)" },
  ],
};

export const MOCK_JOB_DESCRIPTION = `
Nous recherchons un(e) Product Designer Senior pour rejoindre notre équipe Produit.

Missions :
- Concevoir les interfaces utilisateur de notre plateforme SaaS B2B (10 000+ clients)
- Travailler en collaboration étroite avec les Product Managers et développeurs React
- Établir et maintenir notre design system sous Figma et Storybook
- Conduire des recherches utilisateurs et tests d'utilisabilité
- Définir et suivre les KPIs produit (conversion, NPS, rétention)

Profil recherché :
- 5+ ans d'expérience en Product Design / UX Design sur des produits SaaS
- Maîtrise de Figma (auto-layout, variables, composants)
- Expérience avec des design systems à grande échelle
- Forte culture data et capacité à argumenter les décisions design avec des métriques
- Connaissance des environnements Agile / Shape Up
- Anglais professionnel

Stack : Figma, Storybook, Notion, Linear, React (lecture de code)
`;
