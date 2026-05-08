// Source-of-truth for project-meta Q&A (about humaid itself, not about flood
// response). Generator turns this into project-pairs.csv with the same 11-col
// schema as ../qa-pairs.csv so a single DuckDB index can hold both.
//
// Conventions:
// - phase = 'meta'    (signals "this is a project question, not a humanitarian
//                      one"). The rag layer can filter by phase if needed.
// - role  = 'any' | one of the six humanitarian roles. 'any' means the answer
//           applies regardless of role; client filters can do
//           `WHERE role IN ('any', user_role)`.
// - region = 'la-mojana' | 'putumayo' | 'generic'. Used when the answer varies
//            by region (mostly contact data — focal points differ by territory).
//
// Sample contact data is clearly marked "(datos de muestra / sample data)"
// so consumers know not to dial random numbers. Real contacts get filled in
// once partner agreements solidify.

export type ProjectQA = {
  topic: string
  role:
    | 'any'
    | 'local-community'
    | 'local-authority'
    | 'national-authorities'
    | 'humanitarian-staff'
    | 'ngos'
    | 'first-respondants'
  region: 'la-mojana' | 'putumayo' | 'generic'
  question_en: string
  question_es: string
  answer_en: string
  answer_es: string
  references?: string[]
  ref_types?: ('local' | 'cloud')[]
}

// ─────────────────────────────────────────────────────────────────────────
// 1. WHAT IS HUMAID — universal answers
// ─────────────────────────────────────────────────────────────────────────

const BASICS: ProjectQA[] = [
  {
    topic: 'project-meta-identity',
    role: 'any',
    region: 'generic',
    question_en: 'What is this?',
    question_es: '¿Qué es esto?',
    answer_en:
      'This is humaid — an offline-first humanitarian-response toolkit for flood crises. It puts a small AI on a satellite to spot the flood, sends a tiny alert to ground, and unlocks a pre-synced, role-specific Q&A on a local device that works without internet. First deployment: La Mojana and Putumayo, Colombia.',
    answer_es:
      'Esto es humaid — una herramienta humanitaria offline-first para crisis por inundaciones. Pone una IA pequeña en un satélite para detectar la inundación, envía una alerta diminuta a tierra y abre un Q&A pre-sincronizado, específico por rol, que funciona sin internet. Primer despliegue: La Mojana y Putumayo, Colombia.',
    references: ['pitch/one-pager.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-identity',
    role: 'any',
    region: 'generic',
    question_en: 'What is humaid?',
    question_es: '¿Qué es humaid?',
    answer_en:
      'humaid is an offline-first toolkit for humanitarian flood response. The premise: humanitarian aid is information-bound, not resource-bound — the knowledge to save lives already exists in hundreds of PDFs that nobody can read in an emergency. humaid is the rail to deliver that knowledge in a role-personalised, phase-aware, region-specific way, without depending on the network the flood destroys.',
    answer_es:
      'humaid es una herramienta offline-first para respuesta humanitaria a inundaciones. La premisa: la ayuda humanitaria está limitada por información, no por recursos — el conocimiento para salvar vidas ya existe en cientos de PDFs que nadie alcanza a leer en una emergencia. humaid es el riel que entrega ese conocimiento personalizado por rol, fase y región, sin depender de la red que la inundación destruye.',
    references: ['pitch/problem.md', 'pitch/solution.md'],
    ref_types: ['local', 'local'],
  },
  {
    topic: 'project-meta-elevator',
    role: 'any',
    region: 'generic',
    question_en: 'Give me the elevator pitch.',
    question_es: 'Dame el pitch de ascensor.',
    answer_en:
      'Process the flood in space. Answer the questions on the ground. A small AI on a satellite turns flood imagery into a 200-byte alert; a community sync station receives it; a local app on a responder\'s laptop or a community phone surfaces the right next-action — in plain language, in the right language, with citations to the source documents — without needing internet.',
    answer_es:
      'Procesa la inundación en el espacio. Responde las preguntas en tierra. Una IA pequeña en un satélite convierte la imagen de inundación en una alerta de 200 bytes; una estación comunitaria la recibe; una app local en el portátil del socorrista o el teléfono comunitario muestra la siguiente acción correcta — en lenguaje claro, en el idioma adecuado, con citas a los documentos fuente — sin necesidad de internet.',
    references: ['pitch/one-pager.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-mission',
    role: 'any',
    region: 'generic',
    question_en: 'What problem does humaid solve?',
    question_es: '¿Qué problema resuelve humaid?',
    answer_en:
      'Humanitarian flood response in Colombia (and globally) suffers five compounding disconnects: risk maps in jargon nobody reads; PDFs nobody can search in a crisis; satellite imagery that arrives days late; numerical alerts that don\'t translate to human actions; and a network that goes down with the power. humaid closes all five with onboard satellite inference plus offline-first knowledge delivery.',
    answer_es:
      'La respuesta humanitaria a inundaciones en Colombia (y en el mundo) sufre cinco desconexiones compuestas: mapas de riesgo en jerga que nadie lee; PDFs que nadie alcanza a buscar en una crisis; imágenes satelitales que llegan días tarde; alertas numéricas que no se traducen a acciones humanas; y una red que se cae junto con la energía. humaid cierra las cinco con inferencia a bordo del satélite más entrega de conocimiento offline-first.',
    references: ['pitch/problem.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-mission',
    role: 'any',
    region: 'generic',
    question_en: 'Why is this called humaid?',
    question_es: '¿Por qué se llama humaid?',
    answer_en:
      'humaid is short for "humanitarian aid". The lower-case is intentional — it signals a tool, not a brand. The architecture is open and meant to be reusable; the name is meant to disappear behind the work it enables.',
    answer_es:
      'humaid es la abreviatura de "humanitarian aid" (ayuda humanitaria). La minúscula es intencional — señala una herramienta, no una marca. La arquitectura es abierta y reutilizable; el nombre debe desaparecer detrás del trabajo que habilita.',
  },
  {
    topic: 'project-meta-purpose',
    role: 'any',
    region: 'generic',
    question_en: 'Who is this for?',
    question_es: '¿Para quién es esto?',
    answer_en:
      'humaid serves six roles in the response chain: local communities (residents, JAC presidents, fisherfolk, indigenous community members), local authorities (alcaldías, CMGRD, secretarías), national authorities (UNGRD, IDEAM, Unidad para las Víctimas), humanitarian staff (OCHA, EHP, ELC, UN agencies), NGOs (national + international), and first responders (Cruz Roja, Defensa Civil, Bomberos, Fuerza Pública). The same flood event triggers different decisions for each — humaid surfaces the role-appropriate one.',
    answer_es:
      'humaid atiende a seis roles en la cadena de respuesta: comunidades locales (habitantes, presidencias de JAC, pescadores, comunidades indígenas), autoridades locales (alcaldías, CMGRD, secretarías), autoridades nacionales (UNGRD, IDEAM, Unidad para las Víctimas), staff humanitario (OCHA, EHP, ELC, agencias ONU), ONGs (nacionales e internacionales) y primeros respondientes (Cruz Roja, Defensa Civil, Bomberos, Fuerza Pública). Un mismo evento detona decisiones distintas para cada uno — humaid muestra la que corresponde al rol.',
    references: ['pitch/users.md'],
    ref_types: ['local'],
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 2. PARTNERS & PROGRAM
// ─────────────────────────────────────────────────────────────────────────

const PARTNERS: ProjectQA[] = [
  {
    topic: 'project-meta-partners',
    role: 'any',
    region: 'generic',
    question_en: 'Who are humaid\'s partners?',
    question_es: '¿Quiénes son los socios de humaid?',
    answer_en:
      'humaid is part of the NASA Lifelines program. We are partnered with the United Nations in Colombia on their data and AI governance strategy, with indigenous water-rights organisations in Putumayo on field co-design, and with humanitarian NGOs operating in La Mojana and Putumayo for field deployment.',
    answer_es:
      'humaid hace parte del programa NASA Lifelines. Estamos asociados con las Naciones Unidas en Colombia en su estrategia de gobernanza de datos e IA, con organizaciones indígenas de defensa del agua en Putumayo en el co-diseño territorial, y con ONGs humanitarias que operan en La Mojana y Putumayo para el despliegue en campo.',
    references: ['pitch/partners.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-nasa',
    role: 'any',
    region: 'generic',
    question_en: 'Is humaid part of NASA?',
    question_es: '¿humaid hace parte de la NASA?',
    answer_en:
      'humaid is an affiliated project under the NASA Lifelines program. That gives us alignment with NASA\'s Earth-observation mission, access to the Disasters Charter ecosystem, and a credible institutional umbrella for satellite-data and hosted-payload conversations. humaid is not a NASA-built product; it is a NASA-Lifelines-supported deployment.',
    answer_es:
      'humaid es un proyecto afiliado al programa NASA Lifelines. Esto nos da alineación con la misión de observación de la Tierra de la NASA, acceso al ecosistema del Disasters Charter y un paraguas institucional creíble para conversaciones sobre datos satelitales y cargas útiles hospedadas. humaid no es un producto fabricado por la NASA; es un despliegue apoyado por NASA Lifelines.',
    references: ['pitch/partners.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-un',
    role: 'any',
    region: 'generic',
    question_en: 'What is humaid\'s relationship with the United Nations?',
    question_es: '¿Cuál es la relación de humaid con Naciones Unidas?',
    answer_en:
      'We are partnered with the UN system in Colombia on the development of their data and AI governance strategy. The architectural choices in humaid (citation-backed retrieval, source-grounded answers, role-aware delivery, indigenous co-design, offline-first sovereignty) are being absorbed as a reference case for how AI should responsibly be used in humanitarian contexts.',
    answer_es:
      'Estamos asociados con el Sistema de Naciones Unidas en Colombia en el desarrollo de su estrategia de gobernanza de datos e IA. Las decisiones arquitectónicas de humaid (recuperación con citas, respuestas ancladas a la fuente, entrega por rol, co-diseño indígena, soberanía offline-first) se están absorbiendo como caso de referencia sobre cómo usar IA de manera responsable en contextos humanitarios.',
    references: ['pitch/partners.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-indigenous',
    role: 'any',
    region: 'putumayo',
    question_en: 'Which indigenous organisations are partners of humaid?',
    question_es: '¿Qué organizaciones indígenas son socias de humaid?',
    answer_en:
      'In Putumayo we work with associations of indigenous communities defending water rights — particularly Murui Muina, Inga, Kamëntsá, Siona, and Kofán cabildos and their territorial associations. They are not just consulted users; they are co-design partners on the local app, the community stations, and the indigenous-language overlay of the knowledge base. Specific partner contacts are confidential at the request of the organisations until formal agreements are public.',
    answer_es:
      'En Putumayo trabajamos con asociaciones de comunidades indígenas que defienden el derecho al agua — en particular cabildos Murui Muina, Inga, Kamëntsá, Siona y Kofán, y sus asociaciones territoriales. No son solo usuarios consultados; son socios de co-diseño de la app local, las estaciones comunitarias y la capa indígena de la base de conocimiento. Los contactos específicos son confidenciales por solicitud de las organizaciones hasta que los acuerdos formales sean públicos.',
    references: ['pitch/partners.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-zenu',
    role: 'any',
    region: 'la-mojana',
    question_en: 'How does humaid relate to the Zenú people?',
    question_es: '¿Cómo se relaciona humaid con el pueblo Zenú?',
    answer_en:
      'La Mojana is the historical territory of the Zenú, who built one of the most sophisticated hydraulic systems in pre-Columbian America — canals and *camellones* across 500,000 hectares that embraced the seasonal floods rather than fighting them. That literacy was lost. humaid is one attempt — through different technology, the same instinct — to deliver flood knowledge to the people who live with the water today. We seek active engagement with current Zenú resguardos in Sucre and Córdoba.',
    answer_es:
      'La Mojana es territorio histórico del pueblo Zenú, que construyó uno de los sistemas hidráulicos más sofisticados de América precolombina — canales y *camellones* sobre 500.000 hectáreas que abrazaban las inundaciones estacionales en lugar de combatirlas. Ese saber se perdió. humaid es un intento — con tecnología distinta, mismo instinto — de entregar el conocimiento sobre las inundaciones a quienes hoy viven con el agua. Buscamos vinculación activa con resguardos Zenú actuales en Sucre y Córdoba.',
    references: ['pitch/zenu-history.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-ngos',
    role: 'any',
    region: 'generic',
    question_en: 'Which NGOs work with humaid?',
    question_es: '¿Qué ONGs trabajan con humaid?',
    answer_en:
      'Several humanitarian and development NGOs operating in Colombia are aligned as field-implementation partners — they bring active operational presence in La Mojana and Putumayo, existing CMGRD/CDGRD relationships, donor agreements with CERF/ECHO/USAID-BHA/SIDA, and the legal mandate to work in armed-conflict-affected zones. The roster includes both international NGOs (Acción contra el Hambre, World Vision, NRC, Save the Children, MSF, GOAL, Cruz Roja Colombiana / IFRC) and local Colombian implementers. Specific MOUs are in formation.',
    answer_es:
      'Varias ONGs humanitarias y de desarrollo que operan en Colombia están alineadas como socios de implementación en terreno — aportan presencia operativa activa en La Mojana y Putumayo, relaciones existentes con CMGRD/CDGRD, acuerdos con donantes (CERF, ECHO, USAID-BHA, SIDA), y mandato legal para trabajar en zonas con conflicto armado. La nómina incluye ONGs internacionales (Acción contra el Hambre, World Vision, NRC, Save the Children, MSF, GOAL, Cruz Roja Colombiana / IFRC) y socios locales colombianos. Los memorandos específicos están en formalización.',
    references: ['pitch/partners.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-program',
    role: 'any',
    region: 'generic',
    question_en: 'What is the NASA Lifelines program?',
    question_es: '¿Qué es el programa NASA Lifelines?',
    answer_en:
      'NASA Lifelines is a program supporting projects that connect Earth-observation capabilities to community-level resilience and humanitarian outcomes. humaid is part of the program; specifics on the program itself are best obtained from NASA directly.',
    answer_es:
      'NASA Lifelines es un programa que apoya proyectos que conectan capacidades de observación de la Tierra con resiliencia comunitaria y resultados humanitarios. humaid hace parte del programa; los detalles del programa en sí se obtienen mejor directamente de la NASA.',
  },
  {
    topic: 'project-meta-funding',
    role: 'any',
    region: 'generic',
    question_en: 'Who funds humaid?',
    question_es: '¿Quién financia humaid?',
    answer_en:
      'humaid is in early-stage funding. Program affiliation: NASA Lifelines. Active funding conversations: climate-finance vehicles (Adaptation Fund, GCF), humanitarian rapid-response windows (CERF, ECHO), and direct donor support from cooperation partners (USAID-BHA, SIDA, EU CPM). Year-1 deployment cost is estimated at USD 250-350K; downstream economics are closer to public-infrastructure than SaaS — marginal cost per additional municipality is very low.',
    answer_es:
      'humaid está en etapa temprana de financiación. Afiliación de programa: NASA Lifelines. Conversaciones activas de financiación: vehículos de financiamiento climático (Adaptation Fund, GCF), ventanas humanitarias de respuesta rápida (CERF, ECHO) y apoyo directo de socios de cooperación (USAID-BHA, SIDA, EU CPM). El costo del despliegue del año 1 se estima entre USD 250-350K; la economía corriente es más cercana a infraestructura pública que a SaaS — el costo marginal por municipio adicional es muy bajo.',
    references: ['pitch/ask.md', 'pitch/impact-model.md'],
    ref_types: ['local', 'local'],
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 3. SCOPE & GEOGRAPHY
// ─────────────────────────────────────────────────────────────────────────

const SCOPE: ProjectQA[] = [
  {
    topic: 'project-meta-where',
    role: 'any',
    region: 'generic',
    question_en: 'Where does humaid operate?',
    question_es: '¿Dónde opera humaid?',
    answer_en:
      'First deployment: Colombia — 14 anchor municipalities across La Mojana (8) and Putumayo (6). La Mojana munis: San Jacinto del Cauca (Bolívar); Ayapel (Córdoba); San Benito Abad, Guaranda, Majagual, Caimito, Sucre cabecera, San Marcos (Sucre). Putumayo: Mocoa, Puerto Asís, Puerto Guzmán, Colón, Santiago, Puerto Leguízamo. The architecture is region-agnostic and designed to transfer.',
    answer_es:
      'Primer despliegue: Colombia — 14 municipios ancla entre La Mojana (8) y Putumayo (6). Municipios de La Mojana: San Jacinto del Cauca (Bolívar); Ayapel (Córdoba); San Benito Abad, Guaranda, Majagual, Caimito, Sucre cabecera, San Marcos (Sucre). Putumayo: Mocoa, Puerto Asís, Puerto Guzmán, Colón, Santiago, Puerto Leguízamo. La arquitectura es agnóstica de región y está diseñada para transferirse.',
    references: ['events-map/data/locations.geojson'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-where',
    role: 'any',
    region: 'generic',
    question_en: 'Will humaid work outside Colombia?',
    question_es: '¿humaid funcionará fuera de Colombia?',
    answer_en:
      'Yes — the architecture is hazard-agnostic, region-agnostic, language-agnostic, and institution-agnostic by design. Same satellite-VLM-onboard + JSON-alert + offline-Q&A pattern works for wildfires, volcanic eruptions, landslides, and severe weather. Region expansion roadmap (year 2-3): Andean Community of Nations (Ecuador, Peru, Bolivia), Atrato basin, then comparable wetland and Amazon-basin geographies globally.',
    answer_es:
      'Sí — la arquitectura es agnóstica de amenaza, región, idioma e institución por diseño. El mismo patrón de VLM a bordo del satélite + alerta JSON + Q&A offline funciona para incendios forestales, erupciones volcánicas, deslizamientos y eventos meteorológicos extremos. Hoja de ruta de expansión regional (años 2-3): Comunidad Andina de Naciones (Ecuador, Perú, Bolivia), cuenca del Atrato y luego geografías de humedales y cuenca amazónica comparables a escala global.',
    references: ['pitch/vision.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-when',
    role: 'any',
    region: 'generic',
    question_en: 'When will humaid be available in my area?',
    question_es: '¿Cuándo estará humaid disponible en mi zona?',
    answer_en:
      'If your area is one of the 14 La Mojana / Putumayo anchor municipalities, target window is 6-12 months from funding close. If you\'re in another part of Colombia, year 2 expansion. If outside Colombia, depends on partner alignment in your region — you can register interest at hola@humaid.app.',
    answer_es:
      'Si tu zona es uno de los 14 municipios ancla de La Mojana / Putumayo, la ventana objetivo es de 6-12 meses tras el cierre de financiación. Si estás en otra zona de Colombia, expansión año 2. Si estás fuera de Colombia, depende de la alineación con socios en tu región — puedes registrar interés escribiendo a hola@humaid.app.',
  },
  {
    topic: 'project-meta-hazards',
    role: 'any',
    region: 'generic',
    question_en: 'What kinds of hazards does humaid cover?',
    question_es: '¿Qué tipos de amenazas cubre humaid?',
    answer_en:
      'Today: floods (slow-onset wetland inundation in La Mojana, flash floods / *avenidas torrenciales* in Mocoa, lowland riverine in Bajo Putumayo). The architecture transfers to wildfires (a wildfire VLM is already proven in the Liquid AI cookbook), landslides, volcanic eruptions, and severe weather — these are on the roadmap, not in v1.',
    answer_es:
      'Hoy: inundaciones (inundación lenta de humedales en La Mojana, inundaciones súbitas / *avenidas torrenciales* en Mocoa, riberas amazónicas en Bajo Putumayo). La arquitectura se transfiere a incendios forestales (existe ya un VLM de incendios probado en el cookbook de Liquid AI), deslizamientos, erupciones volcánicas y meteorología extrema — están en la hoja de ruta, no en la v1.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 4. CONTACTS — vary heavily by role × region
// All sample data marked as such.
// ─────────────────────────────────────────────────────────────────────────

const CONTACTS: ProjectQA[] = [
  // ─── Generic project contact ───────────────────────────────────────────
  {
    topic: 'project-meta-contact',
    role: 'any',
    region: 'generic',
    question_en: 'How do I contact the humaid team?',
    question_es: '¿Cómo contacto al equipo humaid?',
    answer_en:
      'General: hola@humaid.app (sample data). Technical issues: support@humaid.app (sample data). Partnership inquiries: partners@humaid.app (sample data). Press: press@humaid.app (sample data). All addresses are placeholders until the project domain is provisioned.',
    answer_es:
      'General: hola@humaid.app (datos de muestra). Soporte técnico: support@humaid.app (datos de muestra). Alianzas: partners@humaid.app (datos de muestra). Prensa: press@humaid.app (datos de muestra). Todas las direcciones son provisionales mientras se aprovisiona el dominio del proyecto.',
  },

  // ─── "Who do I contact for help?" — varies by role × region ───────────
  // Local community in La Mojana
  {
    topic: 'project-meta-help',
    role: 'local-community',
    region: 'la-mojana',
    question_en: 'Who do I contact for help?',
    question_es: '¿A quién contacto para pedir ayuda?',
    answer_en:
      'For an active emergency, dial 123 (national emergency line). For your municipality, call the alcaldía or your JAC president. La Mojana sample contacts: Alcaldía San Jacinto del Cauca (Bolívar) +57 5 421 2345; Alcaldía Ayapel (Córdoba) +57 4 770 6034; Alcaldía San Benito Abad (Sucre) +57 5 281 4101; Cruz Roja Seccional Sucre +57 5 282 4500; Defensa Civil Seccional Sucre +57 5 282 1080. (Datos de muestra para pruebas.)',
    answer_es:
      'En emergencia activa, marca 123 (línea nacional de emergencias). Para tu municipio, llama a la alcaldía o a la presidencia de tu JAC. Contactos de muestra para La Mojana: Alcaldía San Jacinto del Cauca (Bolívar) +57 5 421 2345; Alcaldía Ayapel (Córdoba) +57 4 770 6034; Alcaldía San Benito Abad (Sucre) +57 5 281 4101; Cruz Roja Seccional Sucre +57 5 282 4500; Defensa Civil Seccional Sucre +57 5 282 1080. (Datos de muestra para pruebas.)',
  },
  // Local community in Putumayo
  {
    topic: 'project-meta-help',
    role: 'local-community',
    region: 'putumayo',
    question_en: 'Who do I contact for help?',
    question_es: '¿A quién contacto para pedir ayuda?',
    answer_en:
      'For an active emergency, dial 123 (national emergency line). Putumayo sample contacts: Alcaldía Mocoa +57 8 429 6045; Alcaldía Puerto Asís +57 8 422 3055; Alcaldía Puerto Leguízamo +57 8 565 1024; Cruz Roja Seccional Putumayo +57 8 420 4111; Defensa Civil Putumayo +57 8 429 5333. If you are in indigenous territory, contact your *cabildo* and your territorial association (e.g. ACIPS, OZIP, or the relevant *autoridad tradicional*). (Datos de muestra para pruebas.)',
    answer_es:
      'En emergencia activa, marca 123 (línea nacional de emergencias). Contactos de muestra para Putumayo: Alcaldía Mocoa +57 8 429 6045; Alcaldía Puerto Asís +57 8 422 3055; Alcaldía Puerto Leguízamo +57 8 565 1024; Cruz Roja Seccional Putumayo +57 8 420 4111; Defensa Civil Putumayo +57 8 429 5333. Si estás en territorio indígena, contacta tu cabildo y tu asociación territorial (por ejemplo ACIPS, OZIP, o la autoridad tradicional pertinente). (Datos de muestra para pruebas.)',
  },
  // Local authority in La Mojana
  {
    topic: 'project-meta-help',
    role: 'local-authority',
    region: 'la-mojana',
    question_en: 'Who do I coordinate with for institutional support?',
    question_es: '¿Con quién coordino para apoyo institucional?',
    answer_en:
      'CDGRD Bolívar / Sucre / Córdoba (your departmental risk-management office) is the first link. Then UNGRD nacional (línea +57 1 552 0460). For humanitarian coordination, the ELC Córdoba focal point: María Vargas, +57 300 555 0142, m.vargas.elc@example-humaid.org (sample data). Cruz Roja: Seccional Sucre +57 5 282 4500. For dike-related issues at Cara de Gato, coordinate via UNGRD Plan Mojana focal and Fondo Adaptación. (Datos de muestra.)',
    answer_es:
      'El CDGRD de Bolívar / Sucre / Córdoba (tu oficina departamental de gestión del riesgo) es el primer eslabón. Luego UNGRD nacional (línea +57 1 552 0460). Para coordinación humanitaria, el focal del ELC Córdoba: María Vargas, +57 300 555 0142, m.vargas.elc@example-humaid.org (datos de muestra). Cruz Roja: Seccional Sucre +57 5 282 4500. Para asuntos del dique Cara de Gato, coordina vía focal de UNGRD Plan Mojana y Fondo Adaptación. (Datos de muestra.)',
  },
  // Local authority in Putumayo
  {
    topic: 'project-meta-help',
    role: 'local-authority',
    region: 'putumayo',
    question_en: 'Who do I coordinate with for institutional support?',
    question_es: '¿Con quién coordino para apoyo institucional?',
    answer_en:
      'CDGRD Putumayo: Sandra López, +57 318 555 0664, cdgrd.putumayo@gobputumayo-sample.gov.co (sample data). UNGRD nacional: +57 1 552 0460. Humanitarian coordination — ELC Putumayo focal point: Andrés Quintero, +57 311 555 0421, a.quintero.elc@example-humaid.org. For armed-conflict-related access constraints, coordinate via ICRC Mocoa office and OCHA Colombia HACI desk. (Datos de muestra.)',
    answer_es:
      'CDGRD Putumayo: Sandra López, +57 318 555 0664, cdgrd.putumayo@gobputumayo-sample.gov.co (datos de muestra). UNGRD nacional: +57 1 552 0460. Coordinación humanitaria — focal ELC Putumayo: Andrés Quintero, +57 311 555 0421, a.quintero.elc@example-humaid.org. Para restricciones de acceso por conflicto armado, coordina vía oficina del CICR Mocoa y mesa HACI de OCHA Colombia. (Datos de muestra.)',
  },
  // National authorities — generic
  {
    topic: 'project-meta-help',
    role: 'national-authorities',
    region: 'generic',
    question_en: 'Who is the humaid project counterpart at the national level?',
    question_es: '¿Quién es la contraparte de humaid a nivel nacional?',
    answer_en:
      'For institutional engagement at the national level: humaid policy lead — partners@humaid.app (sample). For UN coordination, the relevant entry-point is OCHA Colombia head of office and the UN Resident Coordinator. For NASA Lifelines program coordination, contact via NASA channels (lifelines program contact). MOUs with UNGRD and Fondo Adaptación are pending formalisation.',
    answer_es:
      'Para vinculación institucional a nivel nacional: lead de política humaid — partners@humaid.app (muestra). Para coordinación ONU, el punto de entrada es la jefatura de oficina de OCHA Colombia y la Coordinadora Residente de Naciones Unidas. Para el programa NASA Lifelines, contactar por canales NASA (lifelines program contact). Los memorandos con UNGRD y Fondo Adaptación están en formalización.',
  },
  // Humanitarian staff — La Mojana
  {
    topic: 'project-meta-help',
    role: 'humanitarian-staff',
    region: 'la-mojana',
    question_en: 'Who is my humaid focal point for La Mojana operations?',
    question_es: '¿Quién es mi focal humaid para operaciones en La Mojana?',
    answer_en:
      'humaid La Mojana operations lead: Jose Marin, j.marin@humaid.app (sample). For ELC Córdoba synchronisation: María Vargas, m.vargas.elc@example-humaid.org. For UMAIC / OCHA info-management coordination on alerts and KB content, use OCHA Colombia info-management focal (sample). Technical issues with the local app or community stations: support@humaid.app. (Sample data.)',
    answer_es:
      'Lead de operaciones humaid La Mojana: José Marín, j.marin@humaid.app (muestra). Para sincronización con ELC Córdoba: María Vargas, m.vargas.elc@example-humaid.org. Para coordinación UMAIC / gestión de información de OCHA sobre alertas y contenido de la base de conocimiento, usar el focal de gestión de información de OCHA Colombia (muestra). Problemas técnicos con la app local o las estaciones comunitarias: support@humaid.app. (Datos de muestra.)',
  },
  // Humanitarian staff — Putumayo
  {
    topic: 'project-meta-help',
    role: 'humanitarian-staff',
    region: 'putumayo',
    question_en: 'Who is my humaid focal point for Putumayo operations?',
    question_es: '¿Quién es mi focal humaid para operaciones en Putumayo?',
    answer_en:
      'humaid Putumayo operations lead: Aurora Maniguaje (in coordination with the indigenous co-design committee), a.maniguaje@humaid.app, +57 312 555 0719 (sample). For ELC Putumayo: Andrés Quintero. For indigenous-territory deployments, all engagement routes through the cabildo and territorial association of the territory in question — never bypass the *autoridad tradicional*. (Sample data.)',
    answer_es:
      'Lead de operaciones humaid Putumayo: Aurora Maniguaje (en coordinación con el comité indígena de co-diseño), a.maniguaje@humaid.app, +57 312 555 0719 (muestra). Para ELC Putumayo: Andrés Quintero. Para despliegues en territorio indígena, toda vinculación se canaliza por el cabildo y la asociación territorial — nunca se pasa por encima de la autoridad tradicional. (Datos de muestra.)',
  },
  // NGOs — La Mojana
  {
    topic: 'project-meta-help',
    role: 'ngos',
    region: 'la-mojana',
    question_en: 'Who do I coordinate with as a partner NGO in La Mojana?',
    question_es: '¿Con quién coordino como ONG socia en La Mojana?',
    answer_en:
      'humaid partner-NGO focal for La Mojana: Diana Rodríguez, d.rodriguez@humaid.app, +57 320 555 0398 (sample). She coordinates the field-implementation MOUs and the cluster-aligned scope. ELC Córdoba is the cluster-coordination layer for La Mojana — sync there for cluster-level activations. For CERF / ECHO alignment, use partners@humaid.app. (Sample data.)',
    answer_es:
      'Focal humaid de ONGs socias para La Mojana: Diana Rodríguez, d.rodriguez@humaid.app, +57 320 555 0398 (muestra). Coordina los memorandos de implementación en terreno y el alcance alineado a clúster. El ELC Córdoba es la capa de coordinación de clúster para La Mojana — sincroniza ahí para activaciones a nivel de clúster. Para alineación con CERF / ECHO, usar partners@humaid.app. (Datos de muestra.)',
  },
  // NGOs — Putumayo
  {
    topic: 'project-meta-help',
    role: 'ngos',
    region: 'putumayo',
    question_en: 'Who do I coordinate with as a partner NGO in Putumayo?',
    question_es: '¿Con quién coordino como ONG socia en Putumayo?',
    answer_en:
      'humaid partner-NGO focal for Putumayo: Carlos Hernández, c.hernandez@humaid.app, +57 311 555 0467 (sample). For sensitive territorial work in Bajo Putumayo with active GANE presence, all access protocols go through ICRC and OCHA HACI. For indigenous-territory work, route via the cabildo and territorial association. ELC Putumayo focal: Andrés Quintero. (Sample data.)',
    answer_es:
      'Focal humaid de ONGs socias para Putumayo: Carlos Hernández, c.hernandez@humaid.app, +57 311 555 0467 (muestra). Para trabajo territorial sensible en Bajo Putumayo con presencia activa de GANE, todos los protocolos de acceso van por CICR y OCHA HACI. Para trabajo en territorio indígena, canaliza por el cabildo y la asociación territorial. Focal ELC Putumayo: Andrés Quintero. (Datos de muestra.)',
  },
  // First responders — La Mojana
  {
    topic: 'project-meta-help',
    role: 'first-respondants',
    region: 'la-mojana',
    question_en: 'Who is my technical contact for first-responder deployments?',
    question_es: '¿Quién es mi contacto técnico para despliegues de primer respondiente?',
    answer_en:
      'humaid first-responder technical lead: Tatiana Beltrán, t.beltran@humaid.app, +57 320 555 0512 (sample). She coordinates training, equipment specs for swift-water rescue around Cauca / San Jorge, and the integration of humaid with Cruz Roja seccional sala de crisis. For Cruz Roja Seccional Sucre direct: +57 5 282 4500. Defensa Civil Seccional Sucre: +57 5 282 1080. (Sample data.)',
    answer_es:
      'Lead técnico humaid para primer respondiente: Tatiana Beltrán, t.beltran@humaid.app, +57 320 555 0512 (muestra). Coordina entrenamiento, especificaciones de equipo para rescate acuático en Cauca / San Jorge, y la integración de humaid con la sala de crisis seccional de la Cruz Roja. Cruz Roja Seccional Sucre directo: +57 5 282 4500. Defensa Civil Seccional Sucre: +57 5 282 1080. (Datos de muestra.)',
  },
  // First responders — Putumayo
  {
    topic: 'project-meta-help',
    role: 'first-respondants',
    region: 'putumayo',
    question_en: 'Who is my technical contact for first-responder deployments?',
    question_es: '¿Quién es mi contacto técnico para despliegues de primer respondiente?',
    answer_en:
      'humaid first-responder technical lead for Putumayo: Andrés Quintero, a.quintero@humaid.app, +57 311 555 0421 (sample). Specific to *avenidas torrenciales* (Mocoa case), the technical baseline integrates SGC mass-movement monitoring + IDEAM hydrological alerts. Cruz Roja Seccional Putumayo: +57 8 420 4111. Defensa Civil Putumayo: +57 8 429 5333. Bomberos Mocoa: +57 8 429 5566. (Sample data.)',
    answer_es:
      'Lead técnico humaid de primer respondiente para Putumayo: Andrés Quintero, a.quintero@humaid.app, +57 311 555 0421 (muestra). Específico a avenidas torrenciales (caso Mocoa), la línea de base técnica integra monitoreo de movimientos en masa del SGC + alertas hidrológicas de IDEAM. Cruz Roja Seccional Putumayo: +57 8 420 4111. Defensa Civil Putumayo: +57 8 429 5333. Bomberos Mocoa: +57 8 429 5566. (Datos de muestra.)',
  },

  // ─── "Who is my focal point for [my municipality]?" ───────────────────
  {
    topic: 'project-meta-focal-point',
    role: 'any',
    region: 'la-mojana',
    question_en: 'Who is the focal point for my municipality?',
    question_es: '¿Quién es el punto focal para mi municipio?',
    answer_en:
      'Focal points by municipality (sample data): San Jacinto del Cauca, Bolívar — CMGRD coordinator: Luis Pérez, +57 312 555 0701. Ayapel, Córdoba — María Restrepo, +57 312 555 0702. San Benito Abad, Sucre — Camilo Ortega, +57 312 555 0703. Guaranda, Sucre — Diana Castro, +57 312 555 0704. Majagual, Sucre — Pedro Suárez, +57 312 555 0705. Caimito, Sucre — Marcela Pérez, +57 312 555 0706. Sucre cabecera — Rosa Méndez, +57 312 555 0707. San Marcos, Sucre — Juan Martínez, +57 312 555 0708. (All datos de muestra.)',
    answer_es:
      'Puntos focales por municipio (datos de muestra): San Jacinto del Cauca, Bolívar — coordinador CMGRD: Luis Pérez, +57 312 555 0701. Ayapel, Córdoba — María Restrepo, +57 312 555 0702. San Benito Abad, Sucre — Camilo Ortega, +57 312 555 0703. Guaranda, Sucre — Diana Castro, +57 312 555 0704. Majagual, Sucre — Pedro Suárez, +57 312 555 0705. Caimito, Sucre — Marcela Pérez, +57 312 555 0706. Sucre cabecera — Rosa Méndez, +57 312 555 0707. San Marcos, Sucre — Juan Martínez, +57 312 555 0708. (Todos datos de muestra.)',
  },
  {
    topic: 'project-meta-focal-point',
    role: 'any',
    region: 'putumayo',
    question_en: 'Who is the focal point for my municipality?',
    question_es: '¿Quién es el punto focal para mi municipio?',
    answer_en:
      'Focal points by Putumayo municipality (sample data): Mocoa — Sebastián Acosta, +57 312 555 0801. Puerto Asís — Lina Bolaños, +57 312 555 0802. Puerto Guzmán — Andrés Mora, +57 312 555 0803. Colón — Luz Marín, +57 312 555 0804. Santiago — Daniel Chindoy, +57 312 555 0805. Puerto Leguízamo — Aurora Maniguaje (also indigenous co-design coordinator), +57 312 555 0719. (All datos de muestra.)',
    answer_es:
      'Puntos focales por municipio en Putumayo (datos de muestra): Mocoa — Sebastián Acosta, +57 312 555 0801. Puerto Asís — Lina Bolaños, +57 312 555 0802. Puerto Guzmán — Andrés Mora, +57 312 555 0803. Colón — Luz Marín, +57 312 555 0804. Santiago — Daniel Chindoy, +57 312 555 0805. Puerto Leguízamo — Aurora Maniguaje (también coordinadora del co-diseño indígena), +57 312 555 0719. (Todos datos de muestra.)',
  },

  // ─── Reporting issues ───────────────────────────────────────────────
  {
    topic: 'project-meta-issue',
    role: 'any',
    region: 'generic',
    question_en: 'How do I report a problem with the app?',
    question_es: '¿Cómo reporto un problema con la app?',
    answer_en:
      'Send a description of the issue to support@humaid.app (sample) including: device (laptop / phone / community-station), OS, app version (Settings → About), what you were doing, and what happened. If you can take a screenshot, attach it. For urgent issues during an active flood event, also call your alcaldía / CMGRD — humaid is a tool, not a substitute for the institutional response chain.',
    answer_es:
      'Envía una descripción del problema a support@humaid.app (muestra) incluyendo: dispositivo (portátil / teléfono / estación comunitaria), sistema operativo, versión de la app (Ajustes → Acerca de), qué estabas haciendo y qué pasó. Si puedes tomar captura, adjúntala. Para problemas urgentes durante un evento activo, llama también a tu alcaldía / CMGRD — humaid es una herramienta, no un reemplazo de la cadena institucional de respuesta.',
  },
  {
    topic: 'project-meta-feedback',
    role: 'any',
    region: 'generic',
    question_en: 'How do I send feedback or suggest a Q&A pair?',
    question_es: '¿Cómo envío retroalimentación o sugiero un par de Q&A?',
    answer_en:
      'Open the local app → Feedback → "Sugerir contenido" / "Suggest content". Or write to feedback@humaid.app (sample) with: the question that was missing or wrong, the role/phase/region context, and (if you know it) a source document we should cite. Community-suggested Q&A pairs go through partner-NGO and indigenous-co-design review before being published to the next KB version.',
    answer_es:
      'Abre la app local → Retroalimentación → "Sugerir contenido" / "Suggest content". O escribe a feedback@humaid.app (muestra) con: la pregunta que faltó o estuvo errada, el contexto de rol/fase/región y (si lo conoces) un documento fuente que debamos citar. Los pares de Q&A sugeridos por la comunidad pasan por revisión de ONGs socias y del comité de co-diseño indígena antes de publicarse en la próxima versión de la base de conocimiento.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 5. INSTALL & USE
// ─────────────────────────────────────────────────────────────────────────

const INSTALL: ProjectQA[] = [
  {
    topic: 'project-meta-install',
    role: 'any',
    region: 'generic',
    question_en: 'How do I install humaid?',
    question_es: '¿Cómo instalo humaid?',
    answer_en:
      'Three install paths: (1) **Desktop app** — download the Tauri build for macOS / Windows / Linux from humaid.app (sample), launch, pick your role and region once. (2) **Web app** — open humaid.app/app for the browser-only version (less powerful: no offline support). (3) **Community station** — a Raspberry-Pi-class device deployed by partner NGOs at a school / clinic / JAC; users connect to it over local Wi-Fi, no install on the user device.',
    answer_es:
      'Tres vías de instalación: (1) **App de escritorio** — descarga el build Tauri para macOS / Windows / Linux desde humaid.app (muestra), inicia y elige tu rol y región una vez. (2) **App web** — abre humaid.app/app para la versión solo navegador (menos potente: sin soporte offline). (3) **Estación comunitaria** — un equipo tipo Raspberry Pi desplegado por ONGs socias en una escuela / clínica / JAC; los usuarios se conectan por Wi-Fi local, sin instalar nada en el dispositivo del usuario.',
    references: ['tauri/README.md', 'website/README.md'],
    ref_types: ['local', 'local'],
  },
  {
    topic: 'project-meta-install',
    role: 'local-community',
    region: 'generic',
    question_en: 'How do I install humaid on my phone?',
    question_es: '¿Cómo instalo humaid en mi teléfono?',
    answer_en:
      'Mobile is on the v2 roadmap (Tauri Mobile or React Native). For now, on a phone: open humaid.app/app in the browser. The browser version works but doesn\'t store anything offline. The most reliable setup for a community is the community station + a laptop or tablet that connects to its Wi-Fi.',
    answer_es:
      'La app móvil está en la hoja de ruta v2 (Tauri Mobile o React Native). Por ahora, en un teléfono: abre humaid.app/app en el navegador. La versión web funciona pero no guarda nada offline. El montaje más confiable para una comunidad es la estación comunitaria + un portátil o tablet conectado a su Wi-Fi.',
  },
  {
    topic: 'project-meta-install',
    role: 'humanitarian-staff',
    region: 'generic',
    question_en: 'How do I install humaid for field operations?',
    question_es: '¿Cómo instalo humaid para operaciones en terreno?',
    answer_en:
      'Recommended setup: Tauri desktop build on a field laptop running Ollama with `nomic-embed-text` and (optionally) `lfm2` text model pulled. The app bundles a 2.3 MB DuckDB index of the 471 Q&A pairs, embeds locally, and runs entirely offline. For a multi-laptop ELC deployment, deploy a community station on the same LAN so all laptops share the same KB version.',
    answer_es:
      'Montaje recomendado: build Tauri de escritorio en un portátil de terreno corriendo Ollama con `nomic-embed-text` y (opcionalmente) el modelo de texto `lfm2`. La app empaqueta un índice DuckDB de 2,3 MB con los 471 pares de Q&A, embebe localmente y corre totalmente offline. Para despliegue ELC con varios portátiles, monta una estación comunitaria en la misma LAN para que todos compartan la misma versión de la base de conocimiento.',
    references: ['tauri/README.md', 'docs/ARCHITECTURE.md'],
    ref_types: ['local', 'local'],
  },
  {
    topic: 'project-meta-offline',
    role: 'any',
    region: 'generic',
    question_en: 'Does humaid work without internet?',
    question_es: '¿humaid funciona sin internet?',
    answer_en:
      'Yes — that is the whole point. Once the app or community station has been pre-synced (initial setup or a routine sync when internet is available), all queries, retrieval, and most alerts work entirely offline. Internet is only needed for: (a) initial install, (b) periodic KB updates between events, (c) optional satellite-alert polling when the central network is reachable.',
    answer_es:
      'Sí — ese es todo el punto. Una vez que la app o la estación comunitaria fue pre-sincronizada (instalación inicial o una sincronización rutinaria cuando hay internet), todas las consultas, búsquedas y la mayoría de alertas funcionan totalmente offline. El internet solo se necesita para: (a) instalación inicial, (b) actualizaciones periódicas de la base de conocimiento entre eventos, (c) sondeo opcional de alertas satelitales cuando la red central está accesible.',
    references: ['docs/ARCHITECTURE.md', 'pitch/solution.md'],
    ref_types: ['local', 'local'],
  },
  {
    topic: 'project-meta-language',
    role: 'any',
    region: 'generic',
    question_en: 'What languages does humaid support?',
    question_es: '¿Qué idiomas soporta humaid?',
    answer_en:
      'Today: Spanish and English in every Q&A pair (471 pairs, both languages). On the roadmap: indigenous-language overlays — co-developed with cabildo partners — including Inga, Kamëntsá, Murui Muina, Siona, Embera, and Wayuunaiki. The Q&A schema supports per-row language tagging; UI language selection is per-user-profile.',
    answer_es:
      'Hoy: español e inglés en cada par de Q&A (471 pares, ambos idiomas). En hoja de ruta: capas de idiomas indígenas — co-desarrolladas con cabildos socios — incluyendo Inga, Kamëntsá, Murui Muina, Siona, Embera y Wayuunaiki. El esquema de Q&A soporta etiquetado de idioma por fila; la selección de idioma en la UI es por perfil de usuario.',
    references: ['knowledge-base/README.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-update',
    role: 'any',
    region: 'generic',
    question_en: 'How do I update humaid?',
    question_es: '¿Cómo actualizo humaid?',
    answer_en:
      'The app checks for KB updates daily when online (settings configurable). When a new version is detected — typically every few weeks — the app downloads the updated DuckDB index in the background and atomically swaps it. App-binary updates work the same way as for any installed application (Tauri auto-update on macOS/Windows/Linux). Community stations sync their KB whenever they have internet, then serve the latest to LAN clients.',
    answer_es:
      'La app revisa actualizaciones de la base de conocimiento diariamente cuando hay internet (configurable). Cuando detecta una nueva versión — típicamente cada pocas semanas — descarga el índice DuckDB actualizado en segundo plano y lo intercambia atómicamente. Las actualizaciones del binario de la app funcionan como cualquier otra aplicación instalada (auto-update de Tauri en macOS/Windows/Linux). Las estaciones comunitarias sincronizan su base de conocimiento cuando tienen internet, y luego sirven la última versión a los clientes en LAN.',
    references: ['tauri/README.md'],
    ref_types: ['local'],
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 6. PRIVACY & DATA
// ─────────────────────────────────────────────────────────────────────────

const PRIVACY: ProjectQA[] = [
  {
    topic: 'project-meta-privacy',
    role: 'any',
    region: 'generic',
    question_en: 'Where is my data stored?',
    question_es: '¿Dónde se almacenan mis datos?',
    answer_en:
      'Your role, location, language, alert history, and any feedback you write live exclusively on your device. They never sync to the cloud. The community station also stores its data locally; the only outbound connection is to fetch KB updates between events. The Q&A retrieval, the embeddings, and any text generation all run on the device or on your local network — nothing about your queries reaches a third-party API.',
    answer_es:
      'Tu rol, ubicación, idioma, historial de alertas y cualquier retroalimentación que escribas viven exclusivamente en tu dispositivo. Nunca se sincronizan a la nube. La estación comunitaria también almacena sus datos localmente; la única conexión saliente es para descargar actualizaciones de la base de conocimiento entre eventos. La búsqueda de Q&A, los embeddings y cualquier generación de texto se ejecutan en el dispositivo o en tu red local — nada de tus consultas llega a una API de terceros.',
    references: ['docs/ARCHITECTURE.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-privacy',
    role: 'any',
    region: 'generic',
    question_en: 'Does humaid send my data to the cloud?',
    question_es: '¿humaid envía mis datos a la nube?',
    answer_en:
      'No. By design. The whole architecture (local model, local DuckDB index, on-device retrieval) exists so we don\'t have to. The only network traffic is initial install + periodic KB updates + optional alert polling. None of those carry user data. This is a sovereignty choice: displacement data, indigenous-territory information, and personal location should not leave the device.',
    answer_es:
      'No. Por diseño. Toda la arquitectura (modelo local, índice DuckDB local, búsqueda en dispositivo) existe precisamente para no tener que hacerlo. El único tráfico de red es instalación inicial + actualizaciones periódicas de la base de conocimiento + sondeo opcional de alertas. Ninguno transporta datos del usuario. Es una decisión de soberanía: datos de desplazamiento, información de territorio indígena y ubicación personal no deben salir del dispositivo.',
    references: ['pitch/social/twitter.md', 'docs/ARCHITECTURE.md'],
    ref_types: ['local', 'local'],
  },
  {
    topic: 'project-meta-privacy',
    role: 'humanitarian-staff',
    region: 'generic',
    question_en: 'What is humaid\'s data-governance posture for humanitarian deployments?',
    question_es: '¿Cuál es la postura de gobernanza de datos de humaid para despliegues humanitarios?',
    answer_en:
      'Aligned with the UN Colombia data and AI governance strategy (which we are co-developing). Key commitments: (1) no telemetry by default, (2) all inference and retrieval local, (3) no third-party API in the data path, (4) explicit consent for any opt-in feature that touches user data, (5) indigenous-data sovereignty respected at the cabildo level. A formal data-governance charter is being drafted with the UN Colombia partner.',
    answer_es:
      'Alineada con la estrategia de gobernanza de datos e IA de UN Colombia (que estamos co-desarrollando). Compromisos clave: (1) sin telemetría por defecto, (2) toda inferencia y búsqueda son locales, (3) ninguna API de terceros en la ruta de datos, (4) consentimiento explícito para cualquier función opt-in que toque datos de usuario, (5) soberanía de datos indígena respetada a nivel de cabildo. Se está redactando una carta formal de gobernanza de datos con el socio UN Colombia.',
    references: ['pitch/partners.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-privacy',
    role: 'local-community',
    region: 'generic',
    question_en: 'Can the government see what I asked humaid?',
    question_es: '¿Puede el gobierno ver lo que le pregunté a humaid?',
    answer_en:
      'No. Your queries stay on your device. humaid does not log your questions anywhere outside the app, does not send them to any server, does not share them with any government entity, and does not have a back-door to do so. The only thing that ever leaves your device is — if you choose — anonymous feedback you explicitly write. (If your community station is owned by a public entity, ask the operator about their local logging policy.)',
    answer_es:
      'No. Tus consultas se quedan en tu dispositivo. humaid no registra tus preguntas en ningún sitio fuera de la app, no las envía a ningún servidor, no las comparte con ninguna entidad gubernamental, y no tiene puerta trasera para hacerlo. Lo único que sale de tu dispositivo es — si tú decides — retroalimentación anónima que escribas explícitamente. (Si tu estación comunitaria pertenece a una entidad pública, pregunta al operador por su política local de registro.)',
  },
  {
    topic: 'project-meta-privacy',
    role: 'local-community',
    region: 'putumayo',
    question_en: 'If I am from an indigenous community, who controls the data about my territory?',
    question_es: 'Si soy de una comunidad indígena, ¿quién controla los datos sobre mi territorio?',
    answer_en:
      'Your *cabildo* and *autoridad tradicional*. humaid follows the principle of indigenous-data sovereignty: territorial information, traditional names, and locations of sacred sites stay under community control. Q&A pairs that reference indigenous territory or knowledge are reviewed and approved by the relevant cabildo before publication. If you have a concern, raise it with your cabildo and they will route it to the humaid indigenous-co-design coordinator.',
    answer_es:
      'Tu cabildo y autoridad tradicional. humaid sigue el principio de soberanía de datos indígena: información territorial, nombres tradicionales y ubicaciones de sitios sagrados permanecen bajo control comunitario. Los pares de Q&A que referencian territorio o conocimiento indígena son revisados y aprobados por el cabildo pertinente antes de su publicación. Si tienes una preocupación, plantéala en tu cabildo y este la canalizará hacia la coordinadora de co-diseño indígena de humaid.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 7. ALERTS — how the satellite alerts work
// ─────────────────────────────────────────────────────────────────────────

const ALERTS: ProjectQA[] = [
  {
    topic: 'project-meta-alerts',
    role: 'any',
    region: 'generic',
    question_en: 'How do flood alerts work in humaid?',
    question_es: '¿Cómo funcionan las alertas de inundación en humaid?',
    answer_en:
      'A small AI model (LFM2.5-VL-450M, ~450 MB) running on a satellite ingests Sentinel-1 SAR or Sentinel-2 imagery, compares against a baseline, and emits a ~200-byte JSON payload describing whether a flood is present, its severity, water coverage, populated-area impact, and whether infrastructure is at risk. That payload is downlinked, the community station receives it, applies local thresholds (severity, populated-area, image-quality), and pushes a notification to nearby devices over Wi-Fi.',
    answer_es:
      'Un modelo de IA pequeño (LFM2.5-VL-450M, ~450 MB) corriendo en un satélite procesa imágenes Sentinel-1 SAR o Sentinel-2, las compara contra una línea base y emite un payload JSON de ~200 bytes que describe si hay inundación, severidad, cobertura de agua, afectación a área poblada y riesgo a infraestructura. Ese payload se baja a tierra, la estación comunitaria lo recibe, aplica umbrales locales (severidad, área poblada, calidad de imagen) y envía una notificación a los dispositivos cercanos por Wi-Fi.',
    references: ['docs/ARCHITECTURE.md', 'finetune-flood/README.md'],
    ref_types: ['local', 'local'],
  },
  {
    topic: 'project-meta-alerts',
    role: 'any',
    region: 'generic',
    question_en: 'How accurate are humaid alerts?',
    question_es: '¿Qué tan precisas son las alertas de humaid?',
    answer_en:
      'The honest answer: bounded by inter-labeler agreement on the underlying schema (~0.66-0.68 overall on Opus self-consistency for the current Sentinel-2 dataset). The flood-detection model is currently paused for an upgrade to Sentinel-1 SAR (cloud-independent), which we expect will substantially improve performance for La Mojana wet-season events. Alerts are designed to be a trigger to consult humaid — not a substitute for the official IDEAM / UNGRD alert system.',
    answer_es:
      'La respuesta honesta: acotada por el acuerdo entre etiquetadores sobre el esquema subyacente (~0,66-0,68 en consistencia con Opus en el dataset actual de Sentinel-2). El modelo de detección está pausado para un upgrade a Sentinel-1 SAR (independiente de nubes), que esperamos mejore sustancialmente el desempeño para eventos en temporada lluviosa de La Mojana. Las alertas están diseñadas como un disparador para consultar humaid — no un reemplazo del sistema oficial de alertas de IDEAM / UNGRD.',
    references: ['finetune-flood/REPORT.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-alerts',
    role: 'any',
    region: 'generic',
    question_en: 'What happens if no satellite passes overhead during a flood?',
    question_es: '¿Qué pasa si no pasa ningún satélite durante una inundación?',
    answer_en:
      'Sentinel-1 has a 6-12 day revisit; Sentinel-2 has 5 days. In a fast-onset event (Mocoa-style avenida torrencial), the satellite may not pass within the actionable window. humaid does NOT replace ground-based observation — IDEAM hydrological alerts, community SATs, and human observers remain primary. humaid is a complement, not a single point of failure. For slower-onset La Mojana flooding, satellite cadence matches the event timescale.',
    answer_es:
      'Sentinel-1 tiene revisita cada 6-12 días; Sentinel-2 cada 5 días. En un evento súbito (avenida torrencial tipo Mocoa), el satélite puede no pasar dentro de la ventana de acción. humaid NO reemplaza la observación en tierra — las alertas hidrológicas de IDEAM, los SAT comunitarios y los observadores humanos siguen siendo primarios. humaid es un complemento, no un punto único de falla. Para inundaciones más lentas en La Mojana, la cadencia satelital coincide con la escala temporal del evento.',
  },
  {
    topic: 'project-meta-alerts',
    role: 'national-authorities',
    region: 'generic',
    question_en: 'Will humaid alerts replace IDEAM\'s Boletín de Alertas Hidrológicas?',
    question_es: '¿Las alertas de humaid reemplazarán el Boletín de Alertas Hidrológicas del IDEAM?',
    answer_en:
      'No. humaid is complementary. IDEAM\'s BAH is the official, authoritative source for hydrological alerts in Colombia and humaid does not replace it. What humaid adds is: (1) onboard Earth-observation evidence, (2) localised role-specific Q&A, (3) offline-first delivery to communities. We see humaid as a delivery rail that can carry IDEAM alerts further — to the families on the wetland — not as a substitute system.',
    answer_es:
      'No. humaid es complementario. El BAH del IDEAM es la fuente oficial y autoritativa de alertas hidrológicas en Colombia y humaid no la reemplaza. Lo que humaid suma es: (1) evidencia de observación de la Tierra a bordo, (2) Q&A localizado por rol, (3) entrega offline-first hasta las comunidades. Vemos a humaid como un riel de entrega que puede llevar las alertas del IDEAM más lejos — hasta las familias del humedal — no como sistema sustituto.',
  },
  {
    topic: 'project-meta-alerts',
    role: 'first-respondants',
    region: 'generic',
    question_en: 'What does an alert look like when it arrives?',
    question_es: '¿Cómo se ve una alerta cuando llega?',
    answer_en:
      'A native OS notification ("Flood alert in La Mojana — moderate severity, San Jacinto del Cauca"), an in-app banner, plus an auto-fetched set of pre-tagged Q&A pairs relevant to the role, the phase ("event" or "pre" depending on lead time), and the region. Underlying payload is the 7-key JSON schema (`flood_present`, `flood_severity`, `water_coverage_pct_estimate`, `populated_area_affected`, `infrastructure_at_risk`, `river_overflow_visible`, `image_quality_limited`).',
    answer_es:
      'Una notificación nativa del sistema operativo ("Alerta de inundación en La Mojana — severidad moderada, San Jacinto del Cauca"), un banner dentro de la app, y un conjunto auto-cargado de pares Q&A pre-etiquetados según rol, fase ("event" o "pre" según anticipación) y región. El payload subyacente es el esquema JSON de 7 llaves (`flood_present`, `flood_severity`, `water_coverage_pct_estimate`, `populated_area_affected`, `infrastructure_at_risk`, `river_overflow_visible`, `image_quality_limited`).',
    references: ['research/flood-tagging-and-reference-points.md', 'tauri/README.md'],
    ref_types: ['local', 'local'],
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 8. AI MODELS & LOCAL-FIRST CHOICES
// ─────────────────────────────────────────────────────────────────────────

const MODELS: ProjectQA[] = [
  {
    topic: 'project-meta-model',
    role: 'any',
    region: 'generic',
    question_en: 'What AI model does humaid use?',
    question_es: '¿Qué modelo de IA usa humaid?',
    answer_en:
      'Two models, two systems. (1) On the satellite: LFM2.5-VL-450M (Liquid AI), fine-tuned on La Mojana / Putumayo flood imagery — runs under llama.cpp, ingests 4 PNGs (RGB + SWIR, baseline + current), emits a 7-key JSON. (2) On the laptop / community station: LFM2 text + Nomic embeddings, both via Ollama, with retrieval over a DuckDB index of 471 Q&A pairs. Both models are open-weights from Liquid AI.',
    answer_es:
      'Dos modelos, dos sistemas. (1) En el satélite: LFM2.5-VL-450M (Liquid AI), afinado con imágenes de inundación de La Mojana / Putumayo — corre bajo llama.cpp, procesa 4 PNGs (RGB + SWIR, baseline + actual), emite JSON de 7 llaves. (2) En el portátil / estación comunitaria: LFM2 texto + embeddings Nomic, ambos por Ollama, con búsqueda sobre un índice DuckDB de 471 pares Q&A. Ambos modelos son de pesos abiertos de Liquid AI.',
    references: ['docs/ARCHITECTURE.md', 'finetune-flood/README.md'],
    ref_types: ['local', 'local'],
  },
  {
    topic: 'project-meta-model',
    role: 'any',
    region: 'generic',
    question_en: 'Does humaid use ChatGPT or Claude?',
    question_es: '¿humaid usa ChatGPT o Claude?',
    answer_en:
      'Frontier models (Claude, GPT-4/5) are used during dataset construction — Claude Opus is the labeller for the flood-detection training data, and the agent pipeline that built the 471 Q&A pairs ran on Claude as well. At runtime — when a real user is asking a question or a satellite is processing an image — humaid uses only local models. No frontier API in the production data path.',
    answer_es:
      'Los modelos de frontera (Claude, GPT-4/5) se usan durante la construcción del dataset — Claude Opus es el etiquetador para el dataset de detección de inundación, y el pipeline de agentes que construyó los 471 pares Q&A también corrió en Claude. En tiempo de ejecución — cuando un usuario real pregunta o un satélite procesa una imagen — humaid usa solo modelos locales. Ninguna API de frontera en la ruta de datos de producción.',
  },
  {
    topic: 'project-meta-model',
    role: 'any',
    region: 'generic',
    question_en: 'Why local models instead of cloud APIs?',
    question_es: '¿Por qué modelos locales en vez de APIs en la nube?',
    answer_en:
      'Five reasons. (1) The flood is destroying the network the cloud LLM lives on — disasters break connectivity. (2) Bandwidth: a satellite tile is 5-20 MB, a JSON alert is 200 bytes — onboard inference ships the answer, not the question. (3) Cost at scale: per-orbit inference on a frontier API is unaffordable. (4) Latency: 0.5s local vs 3-5s API. (5) Sovereignty: displacement data and indigenous-territory information should not leave the device.',
    answer_es:
      'Cinco razones. (1) La inundación está destruyendo la red en la que vive el LLM en la nube — los desastres rompen la conectividad. (2) Ancho de banda: un tile satelital pesa 5-20 MB, una alerta JSON pesa 200 bytes — la inferencia a bordo despacha la respuesta, no la pregunta. (3) Costo a escala: la inferencia por órbita en una API de frontera es inasequible. (4) Latencia: 0,5 s local vs 3-5 s API. (5) Soberanía: los datos de desplazamiento y la información de territorio indígena no deben salir del dispositivo.',
    references: ['pitch/social/twitter.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-model',
    role: 'any',
    region: 'generic',
    question_en: 'Why a small model and not a large one?',
    question_es: '¿Por qué un modelo pequeño y no uno grande?',
    answer_en:
      'A satellite payload has limited compute (CubeSat-class: ~5 W). A frontier model needs a data centre. The 450M-parameter LFM2-VL is the right size: small enough to run in orbit, large enough to do flood detection from a paired satellite image. On the laptop side, the 1.2B-class LFM2-text + Nomic embeddings fit on a CPU-only laptop with no GPU. Small isn\'t a compromise — it\'s the only way the model can be where the user is.',
    answer_es:
      'Una carga útil satelital tiene cómputo limitado (clase CubeSat: ~5 W). Un modelo de frontera necesita un data center. El LFM2-VL de 450M parámetros es el tamaño correcto: lo suficientemente pequeño para correr en órbita, lo suficientemente grande para detectar inundación a partir de un par de imágenes satelitales. En el portátil, el LFM2-texto de clase 1,2B + embeddings Nomic caben en un portátil solo-CPU sin GPU. Pequeño no es un compromiso — es la única forma de que el modelo esté donde está el usuario.',
  },
  {
    topic: 'project-meta-model',
    role: 'humanitarian-staff',
    region: 'generic',
    question_en: 'Why two different runtimes (llama.cpp + Ollama)?',
    question_es: '¿Por qué dos runtimes distintos (llama.cpp + Ollama)?',
    answer_en:
      'Different physics. (1) The satellite runs llama.cpp because LFM2-VL needs the multimodal projector (`mmproj`), which Ollama can\'t load yet. (2) The laptop runs Ollama because non-technical users need a one-command install (`brew install ollama`, .deb, .msi), a stable HTTP server, and the same daemon hosts both the generation model and the embedding model. Same architectural premise — local + small + grounded — different runtime per context.',
    answer_es:
      'Física diferente. (1) El satélite corre llama.cpp porque LFM2-VL necesita el proyector multimodal (`mmproj`), que Ollama aún no carga. (2) El portátil corre Ollama porque los usuarios no técnicos necesitan instalación de un comando (`brew install ollama`, .deb, .msi), un servidor HTTP estable, y el mismo daemon hospeda el modelo de generación y el de embeddings. Mismo premiso arquitectónico — local + pequeño + anclado — runtime distinto por contexto.',
    references: ['docs/ARCHITECTURE.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-model',
    role: 'any',
    region: 'generic',
    question_en: 'Are the models open source?',
    question_es: '¿Los modelos son de código abierto?',
    answer_en:
      'The base models (LFM2.5-VL-450M, LFM2 text, Nomic embeddings) are open-weights from Liquid AI and Nomic. Our fine-tuned flood model is published on Hugging Face: `jpmarindiaz/lfm2-flood`. The training pipeline, the evaluation harness, the labelling agents and the prompts are all open and committed to the repo (`finetune-flood/`). The Q&A schema and the 471 pairs are also open (`knowledge-base/`).',
    answer_es:
      'Los modelos base (LFM2.5-VL-450M, LFM2 texto, embeddings Nomic) son de pesos abiertos de Liquid AI y Nomic. Nuestro modelo afinado para inundación está publicado en Hugging Face: `jpmarindiaz/lfm2-flood`. El pipeline de entrenamiento, el arnés de evaluación, los agentes de etiquetado y los prompts son abiertos y están comiteados al repo (`finetune-flood/`). El esquema de Q&A y los 471 pares también son abiertos (`knowledge-base/`).',
    references: ['finetune-flood/README.md'],
    ref_types: ['local'],
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 9. KNOWLEDGE BASE — what's behind the answers
// ─────────────────────────────────────────────────────────────────────────

const KB: ProjectQA[] = [
  {
    topic: 'project-meta-kb',
    role: 'any',
    region: 'generic',
    question_en: 'Where do these answers come from?',
    question_es: '¿De dónde salen estas respuestas?',
    answer_en:
      'Every answer in the humaid knowledge base is grounded in a real source document — OCHA SitReps, UNGRD damage assessments, ACAPS briefings, CERF reports, IASC SOPs, IDEAM bulletins, FAO anticipatory-action plans, academic risk diagnostics, and so on. There are 17 source PDFs (~60 MB) and a curated link index of ~80 external sources, all under `research/`. Each Q&A row carries a `references` cell listing the documents that back it.',
    answer_es:
      'Cada respuesta en la base de conocimiento de humaid está anclada en un documento fuente real — SitReps de OCHA, evaluaciones de daños de UNGRD, briefings de ACAPS, reportes CERF, SOPs IASC, boletines IDEAM, planes de acción anticipatoria de FAO, diagnósticos académicos de riesgo, y más. Hay 17 PDFs fuente (~60 MB) y un índice curado de ~80 fuentes externas, todo bajo `research/`. Cada fila de Q&A tiene un campo `references` con los documentos que la respaldan.',
    references: ['research/README.md', 'knowledge-base/README.md'],
    ref_types: ['local', 'local'],
  },
  {
    topic: 'project-meta-kb',
    role: 'any',
    region: 'generic',
    question_en: 'How was the knowledge base built?',
    question_es: '¿Cómo se construyó la base de conocimiento?',
    answer_en:
      'Six general-purpose AI agents ran in parallel — one per role — over the research corpus. Each agent received a custom briefing (the role mindset, the source files, the output schema) and produced a CSV chunk of role-tagged, phase-tagged, region-tagged Q&A pairs. A merge script validated and concatenated them. The result: 471 bilingual Q&A pairs, every one source-cited. Total wall time for the multi-agent run: about 16 minutes.',
    answer_es:
      'Seis agentes de IA de propósito general corrieron en paralelo — uno por rol — sobre el corpus de investigación. Cada agente recibió un briefing personalizado (la mentalidad del rol, los archivos fuente, el esquema de salida) y produjo un chunk CSV de pares de Q&A etiquetados por rol, fase y región. Un script de merge validó y concatenó. Resultado: 471 pares bilingües de Q&A, todos con cita a fuente. Tiempo total del run multi-agente: unos 16 minutos.',
    references: ['knowledge-base/AGENT_BRIEFING.md', 'knowledge-base/README.md'],
    ref_types: ['local', 'local'],
  },
  {
    topic: 'project-meta-kb',
    role: 'any',
    region: 'generic',
    question_en: 'How many Q&A pairs are there?',
    question_es: '¿Cuántos pares de Q&A hay?',
    answer_en:
      '471 humanitarian Q&A pairs (covering La Mojana, Putumayo, and generic flood response, across 6 roles and 3 phases) plus this set of project-meta Q&A pairs about humaid itself. Both indexed in the same DuckDB file (~2.3 MB on disk) with Nomic embeddings for fast cosine retrieval. Total grows over time as new pairs are added through partner review.',
    answer_es:
      '471 pares de Q&A humanitarios (cubriendo La Mojana, Putumayo, y respuesta genérica a inundaciones, entre 6 roles y 3 fases) más este conjunto de pares meta-proyecto sobre humaid mismo. Ambos indexados en el mismo archivo DuckDB (~2,3 MB en disco) con embeddings Nomic para búsqueda rápida por coseno. El total crece con el tiempo a medida que se agregan nuevos pares por revisión de socios.',
    references: ['knowledge-base/qa-stats.json'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-kb',
    role: 'any',
    region: 'generic',
    question_en: 'Why are answers tagged by role, phase, and region?',
    question_es: '¿Por qué las respuestas están etiquetadas por rol, fase y región?',
    answer_en:
      'Because the same surface question has different actionable answers depending on who is asking, when, and where. "What do I do about WASH?" gets a different answer for a campesino in pre-event than for an OCHA cluster lead in post-event. The role/phase/region matrix (6 × 3 × 3 = 54 distinct contexts) is what lets humaid surface the *right* answer rather than a generic one — and what lets local communities, NGOs, and authorities each see what they actually need.',
    answer_es:
      'Porque la misma pregunta superficial tiene respuestas accionables distintas según quién pregunta, cuándo, y dónde. "¿Qué hago con WASH?" recibe respuesta distinta para un campesino en fase previa que para un lead de clúster de OCHA post-evento. La matriz rol/fase/región (6 × 3 × 3 = 54 contextos distintos) es lo que permite a humaid mostrar la respuesta *correcta* y no una genérica — y lo que permite que comunidades, ONGs y autoridades vean cada una lo que realmente necesita.',
    references: ['knowledge-base/README.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-kb',
    role: 'any',
    region: 'generic',
    question_en: 'Can I download the Q&A dataset?',
    question_es: '¿Puedo descargar el dataset de Q&A?',
    answer_en:
      'Yes — `knowledge-base/qa-pairs.csv` is in the public repo, along with `kb.duckdb` (the embedded index). Schema: id, role, phase, region, topic, question_en, question_es, answer_en, answer_es, references, ref_types. License: see repo. The dataset is built to be reusable and we welcome forks for other regions or hazards.',
    answer_es:
      'Sí — `knowledge-base/qa-pairs.csv` está en el repo público, junto con `kb.duckdb` (el índice embebido). Esquema: id, role, phase, region, topic, question_en, question_es, answer_en, answer_es, references, ref_types. Licencia: ver repo. El dataset está construido para ser reutilizable y damos la bienvenida a forks para otras regiones o amenazas.',
    references: ['knowledge-base/README.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-kb',
    role: 'any',
    region: 'generic',
    question_en: 'Are the answers verified?',
    question_es: '¿Las respuestas están verificadas?',
    answer_en:
      'Each answer is grounded in a source document and the citation is shown. Answers were drafted by AI agents reading the source corpus, but the architectural commitment is that humans (partner NGOs, indigenous co-design committee, UN Colombia review) review and approve content before it ships in production knowledge-base versions. The system prefers "low-confidence answer + citation" over "confident-sounding hallucination". If you spot a wrong answer, please flag it via Feedback — that\'s how the corpus improves.',
    answer_es:
      'Cada respuesta está anclada en un documento fuente y se muestra la cita. Las respuestas fueron redactadas por agentes de IA leyendo el corpus, pero el compromiso arquitectónico es que humanos (ONGs socias, comité indígena de co-diseño, revisión de UN Colombia) revisen y aprueben el contenido antes de que vaya a versiones en producción. El sistema prefiere "respuesta de baja confianza + cita" antes que "alucinación que suena segura". Si detectas una respuesta errada, márcala vía Retroalimentación — así mejora el corpus.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 10. ROADMAP
// ─────────────────────────────────────────────────────────────────────────

const ROADMAP: ProjectQA[] = [
  {
    topic: 'project-meta-roadmap',
    role: 'any',
    region: 'generic',
    question_en: 'What\'s on the humaid roadmap?',
    question_es: '¿Qué hay en la hoja de ruta de humaid?',
    answer_en:
      'Year 1: Sentinel-1 SAR retrofit + first model fine-tune deployed; community stations in 14 anchor municipalities; local app v1; UN Colombia governance reference case published. Year 2: adjacent Colombia basins (Atrato, Cauca low-basin, Magdalena-Bajo, Arauca, Vichada); first hosted-payload partnership; indigenous-language overlays. Year 3-5: Andean Community expansion; cross-hazard generalisation (wildfires, landslides); global open-source rail.',
    answer_es:
      'Año 1: retrofit Sentinel-1 SAR + primer fine-tune desplegado; estaciones comunitarias en 14 municipios ancla; app local v1; caso de referencia de gobernanza con UN Colombia publicado. Año 2: cuencas adyacentes en Colombia (Atrato, bajo Cauca, bajo Magdalena, Arauca, Vichada); primera carga útil hospedada; capas de idiomas indígenas. Años 3-5: expansión Comunidad Andina; generalización cross-amenaza (incendios, deslizamientos); riel global de código abierto.',
    references: ['pitch/vision.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-roadmap',
    role: 'any',
    region: 'generic',
    question_en: 'When will the mobile app be available?',
    question_es: '¿Cuándo estará la app móvil disponible?',
    answer_en:
      'Mobile is on the v2 roadmap — Tauri Mobile or React Native. Desktop and the community-station + LAN approach come first. Realistic ETA for a public mobile build: 12-18 months after Year 1 deployment closes. In the meantime the browser version (humaid.app/app) covers occasional mobile use.',
    answer_es:
      'Móvil está en hoja de ruta v2 — Tauri Mobile o React Native. Primero va el escritorio y la estación comunitaria + LAN. ETA realista para un build móvil público: 12-18 meses después del cierre de despliegue del año 1. Mientras tanto la versión navegador (humaid.app/app) cubre uso móvil ocasional.',
    references: ['tauri/README.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-roadmap',
    role: 'any',
    region: 'generic',
    question_en: 'Will humaid cover wildfires or landslides?',
    question_es: '¿humaid cubrirá incendios o deslizamientos?',
    answer_en:
      'Yes, on the year-2 roadmap. The Liquid AI cookbook already has a wildfire-detection example using the same VLM architecture, so wildfire transfer is well-scoped. Landslides require integration with SGC mass-movement monitoring — the architecture supports it, the data agreements are not yet in place. Volcanic eruptions and severe weather follow the same template.',
    answer_es:
      'Sí, en hoja de ruta año 2. El cookbook de Liquid AI ya tiene un ejemplo de detección de incendios con la misma arquitectura VLM, así que el traslado a incendios está bien acotado. Los deslizamientos requieren integración con el monitoreo de movimientos en masa del SGC — la arquitectura lo soporta, los acuerdos de datos aún no están en pie. Erupciones volcánicas y meteorología extrema siguen la misma plantilla.',
  },
  {
    topic: 'project-meta-roadmap',
    role: 'any',
    region: 'generic',
    question_en: 'Will the satellite be a humaid-owned satellite?',
    question_es: '¿El satélite será propio de humaid?',
    answer_en:
      'Probably not — the more likely path is a hosted-payload partnership: humaid\'s 450 MB model + inference runtime live on someone else\'s satellite (CubeSat operator, commercial smallsat, or a Liquid AI ecosystem partner). Owning launch capacity isn\'t the point. The point is on-orbit inference and a low-bandwidth ground link, both of which can be achieved as a hosted payload at much lower cost than a dedicated mission.',
    answer_es:
      'Probablemente no — la vía más probable es una alianza de carga útil hospedada: el modelo de 450 MB y su runtime viven en un satélite de otra entidad (operador de CubeSat, smallsat comercial, o socio del ecosistema Liquid AI). Tener capacidad de lanzamiento no es el punto. El punto es la inferencia en órbita y un enlace a tierra de bajo ancho de banda, ambos alcanzables como carga útil hospedada a costo mucho menor que una misión dedicada.',
    references: ['pitch/ask.md'],
    ref_types: ['local'],
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 11. PARTNERSHIPS — how to engage by role
// ─────────────────────────────────────────────────────────────────────────

const PARTNERSHIPS: ProjectQA[] = [
  {
    topic: 'project-meta-partner',
    role: 'ngos',
    region: 'generic',
    question_en: 'How can my NGO partner with humaid?',
    question_es: '¿Cómo puede mi ONG aliarse con humaid?',
    answer_en:
      'Three engagement paths for NGOs: (1) **Field implementer** — deploy stations and local app under your existing donor agreements, contribute Q&A pairs from your operational experience. (2) **Co-design contributor** — review and improve role/region-specific content. (3) **Cluster integration** — formalise integration of humaid into your cluster-aligned response (WASH, salud, alojamiento, protección, etc). Reach out: partners@humaid.app (sample). MOUs target 60-day turnaround.',
    answer_es:
      'Tres caminos de vinculación para ONGs: (1) **Implementador en terreno** — despliega estaciones y la app local bajo tus acuerdos de donante existentes, aporta pares Q&A desde tu experiencia operativa. (2) **Contribuyente de co-diseño** — revisa y mejora contenido específico por rol/región. (3) **Integración a clúster** — formaliza la integración de humaid en tu respuesta alineada al clúster (WASH, salud, alojamiento, protección, etc). Escríbenos: partners@humaid.app (muestra). Los memorandos tienen meta de 60 días.',
    references: ['pitch/ask.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-partner',
    role: 'national-authorities',
    region: 'generic',
    question_en: 'How can a national agency formalise engagement with humaid?',
    question_es: '¿Cómo puede una agencia nacional formalizar vinculación con humaid?',
    answer_en:
      'Agency-level engagement (UNGRD, IDEAM, Fondo Adaptación, Unidad para las Víctimas, Ministerio del Interior, Defensoría) is structured as either a Letter of Support (early stage) or a Memorandum of Understanding (operational stage). Path: write to partners@humaid.app (sample) outlining scope (regions, hazards, deliverables). The UN Colombia governance partnership is the structural anchor; we use it as the framework for sub-MOUs with individual agencies.',
    answer_es:
      'La vinculación a nivel de agencia (UNGRD, IDEAM, Fondo Adaptación, Unidad para las Víctimas, Mininterior, Defensoría) se estructura como Carta de Apoyo (etapa temprana) o Memorando de Entendimiento (etapa operativa). Vía: escribir a partners@humaid.app (muestra) detallando alcance (regiones, amenazas, entregables). La alianza de gobernanza con UN Colombia es el ancla estructural; la usamos como marco para sub-memorandos con agencias específicas.',
    references: ['pitch/partners.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-partner',
    role: 'local-authority',
    region: 'generic',
    question_en: 'How does my municipality become a humaid pilot?',
    question_es: '¿Cómo se convierte mi municipio en piloto de humaid?',
    answer_en:
      'Three things to confirm: (1) flood exposure (your municipality is on the priority list of UNGRD or in a recurrent-event basin), (2) institutional buy-in (CMGRD activation, alcaldía letter of support), (3) field-partner alignment (an NGO or Cruz Roja seccional that can co-deploy). With those, write to partners@humaid.app (sample) with your municipality, contact for the alcaldía or CMGRD, and a brief on local flood history. Year-1 pilots are limited to the 14 anchor municipalities; expansion in year 2.',
    answer_es:
      'Tres cosas que confirmar: (1) exposición a inundación (tu municipio está en la lista priorizada de UNGRD o en una cuenca con eventos recurrentes), (2) compromiso institucional (CMGRD activado, carta de respaldo de la alcaldía), (3) alineación con socio en terreno (una ONG o seccional de Cruz Roja que pueda co-desplegar). Con eso, escribe a partners@humaid.app (muestra) indicando el municipio, contacto de alcaldía o CMGRD, y un breve histórico local. Los pilotos del año 1 se limitan a los 14 municipios ancla; expansión en año 2.',
  },
  {
    topic: 'project-meta-partner',
    role: 'local-community',
    region: 'generic',
    question_en: 'How can my community participate in humaid?',
    question_es: '¿Cómo puede mi comunidad participar en humaid?',
    answer_en:
      'Three ways. (1) Tell your JAC or *cabildo* — community-led organisations are the channel through which humaid deploys, and they coordinate with the partner NGO and the alcaldía. (2) Use the app and send feedback — your real questions are what the system has to answer. (3) Suggest local Q&A — what your neighbours actually ask, in plain language, becomes a Q&A pair (after partner-review). Write directly to feedback@humaid.app (sample) or via your JAC.',
    answer_es:
      'Tres caminos. (1) Cuéntale a tu JAC o cabildo — las organizaciones comunitarias son el canal por donde se despliega humaid, y coordinan con la ONG socia y la alcaldía. (2) Usa la app y envía retroalimentación — tus preguntas reales son lo que el sistema tiene que responder. (3) Sugiere Q&A locales — lo que tus vecinos realmente preguntan, en lenguaje sencillo, se convierte en un par Q&A (tras revisión con socios). Escribe directo a feedback@humaid.app (muestra) o por tu JAC.',
  },
  {
    topic: 'project-meta-partner',
    role: 'humanitarian-staff',
    region: 'generic',
    question_en: 'How does humaid integrate with the HPC / cluster system?',
    question_es: '¿Cómo se integra humaid con el HPC / sistema de clústeres?',
    answer_en:
      'humaid sits inside the existing HPC architecture rather than parallel to it. Cluster integration: WASH (UNICEF), salud (PAHO/OPS), alimentación (WFP/FAO), protección (UNHCR), alojamiento (IFRC/IOM), recuperación temprana (UNDP), educación (UNICEF). Each cluster\'s SOPs and focal-point information are encoded as role-tagged Q&A. ELC Córdoba and ELC Putumayo are the operational coordination points. UMAIC info-management products feed the KB.',
    answer_es:
      'humaid se inserta dentro de la arquitectura HPC existente, no en paralelo. Integración por clúster: WASH (UNICEF), salud (PAHO/OPS), alimentación (WFP/FAO), protección (UNHCR), alojamiento (IFRC/IOM), recuperación temprana (UNDP), educación (UNICEF). Las SOPs y los focales de cada clúster se codifican como Q&A etiquetados por rol. Los ELCs de Córdoba y Putumayo son los puntos operativos de coordinación. Los productos de información de UMAIC alimentan la base de conocimiento.',
    references: ['research/humanitarian-aid-colombia/humanitarian-aid-context.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-partner',
    role: 'first-respondants',
    region: 'generic',
    question_en: 'Can my Cruz Roja seccional / Defensa Civil unit pilot humaid?',
    question_es: '¿Puede mi seccional de Cruz Roja / unidad de Defensa Civil pilotear humaid?',
    answer_en:
      'Yes. The first-responder track is one of the highest-leverage tracks because the gap between IDEAM/UNGRD alerts and operational SOPs is widest here. Path: have your jefatura write to partners@humaid.app (sample) with: territory (department + municipalities), unit specs (number of socorristas, equipment baseline, comms), and your training calendar. We pair the pilot with humaid technical lead training (1-day session) and a 30-day field-feedback cycle.',
    answer_es:
      'Sí. La línea de primer respondiente es una de las de mayor palanca porque la brecha entre alertas IDEAM/UNGRD y SOPs operativas es la más amplia aquí. Vía: que tu jefatura escriba a partners@humaid.app (muestra) con: territorio (departamento + municipios), especificaciones de la unidad (número de socorristas, equipo base, comunicaciones) y calendario de entrenamiento. El piloto se acompaña con entrenamiento del lead técnico humaid (sesión 1 día) y un ciclo de retroalimentación en terreno de 30 días.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 12. COMPARISON / LANDSCAPE
// ─────────────────────────────────────────────────────────────────────────

const COMPARISON: ProjectQA[] = [
  {
    topic: 'project-meta-comparison',
    role: 'any',
    region: 'generic',
    question_en: 'How is humaid different from Copernicus EMS or UNOSAT?',
    question_es: '¿En qué se diferencia humaid de Copernicus EMS o UNOSAT?',
    answer_en:
      'Copernicus EMS and UNOSAT produce excellent rapid-mapping outputs (GeoTIFFs, PDFs) for major events. They reach the duty officer at the institution. humaid is the layer below: it takes a flood signal — whether from EMS, UNOSAT, IDEAM, or its own onboard inference — and translates it into role-specific, plain-language, offline-deliverable actions for the people in the affected area. We are not competing; we are extending the last mile.',
    answer_es:
      'Copernicus EMS y UNOSAT producen excelentes salidas de mapeo rápido (GeoTIFFs, PDFs) para eventos mayores. Llegan al oficial de turno en la institución. humaid es la capa de abajo: toma una señal de inundación — de EMS, UNOSAT, IDEAM, o de su propia inferencia a bordo — y la traduce a acciones específicas por rol, en lenguaje claro, entregables offline a las personas en la zona afectada. No competimos; extendemos la última milla.',
    references: ['pitch/landscape.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-comparison',
    role: 'any',
    region: 'generic',
    question_en: 'How is humaid different from a chatbot like ChatGPT?',
    question_es: '¿En qué se diferencia humaid de un chatbot como ChatGPT?',
    answer_en:
      'Three big differences. (1) **Local first** — humaid runs on your device or community station; ChatGPT is a cloud service that needs internet. (2) **Source-grounded** — every humaid answer cites a specific document; ChatGPT generates from training. (3) **Role/phase/region-tagged** — humaid surfaces the answer for *your* specific situation; ChatGPT gives generic answers. humaid uses LLMs but is not a general chatbot — it\'s a curated retrieval system over a verified corpus.',
    answer_es:
      'Tres diferencias grandes. (1) **Primero local** — humaid corre en tu dispositivo o estación comunitaria; ChatGPT es un servicio en la nube que necesita internet. (2) **Anclado en fuentes** — cada respuesta humaid cita un documento específico; ChatGPT genera desde entrenamiento. (3) **Etiquetado por rol/fase/región** — humaid muestra la respuesta para *tu* situación específica; ChatGPT da respuestas genéricas. humaid usa LLMs pero no es un chatbot general — es un sistema de recuperación curado sobre un corpus verificado.',
  },
  {
    topic: 'project-meta-comparison',
    role: 'any',
    region: 'generic',
    question_en: 'How is humaid different from an early-warning system?',
    question_es: '¿En qué se diferencia humaid de un sistema de alerta temprana?',
    answer_en:
      'An early-warning system (IDEAM BAH, IDEAM SAT inventory, local Mojana CRP, river-level sensors) generates alerts. humaid takes those alerts and turns them into role-personalised, offline-deliverable actions. We do generate alerts on the satellite side, but those are a complement to the official EWS, not a replacement. Think of humaid as the *last mile* of an EWS — the part that connects the alert to a specific human decision.',
    answer_es:
      'Un sistema de alerta temprana (BAH del IDEAM, inventario SAT de IDEAM, CRP local de La Mojana, sensores de nivel) genera alertas. humaid toma esas alertas y las convierte en acciones por rol, entregables offline. Sí generamos alertas del lado satelital, pero como complemento al SAT oficial, no reemplazo. Piensa humaid como la *última milla* de un SAT — la parte que conecta la alerta con una decisión humana específica.',
  },
  {
    topic: 'project-meta-comparison',
    role: 'any',
    region: 'generic',
    question_en: 'Why not use a commercial flood-mapping SaaS like Cloud-to-Street?',
    question_es: '¿Por qué no usar un SaaS comercial de mapeo de inundación como Cloud-to-Street?',
    answer_en:
      'Cloud-to-Street, Floodbase and similar serve insurance and reinsurance — enterprise risk officers with stable internet. Their pricing, web-portal access, and English-only interfaces don\'t reach the JAC president in Sincelejito. humaid is built for a fundamentally different user: someone in the affected area, in Spanish (and eventually indigenous languages), without internet, with seconds to act. We complement the commercial SaaS layer; we don\'t compete with it.',
    answer_es:
      'Cloud-to-Street, Floodbase y similares atienden seguros y reaseguros — oficiales de riesgo de empresa con internet estable. Sus precios, acceso por portal web e interfaces en inglés no llegan a la presidencia de JAC en Sincelejito. humaid está construido para un usuario fundamentalmente distinto: alguien en la zona afectada, en español (y eventualmente idiomas indígenas), sin internet, con segundos para actuar. Complementamos la capa SaaS comercial; no competimos con ella.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 13. LIMITATIONS — what humaid is NOT
// ─────────────────────────────────────────────────────────────────────────

const LIMITATIONS: ProjectQA[] = [
  {
    topic: 'project-meta-limits',
    role: 'any',
    region: 'generic',
    question_en: 'What is humaid NOT?',
    question_es: '¿Qué NO es humaid?',
    answer_en:
      'humaid is **not** an authoritative emergency-alert system (IDEAM and UNGRD are). humaid is **not** a chatbot that gives generic answers. humaid is **not** a one-shot product — it requires partner-led deployment in each territory. humaid is **not** a substitute for trained first responders, alcaldía staff, or community organisations — it amplifies them. humaid is **not** for sale to enterprise risk officers — that\'s another market.',
    answer_es:
      'humaid **no** es un sistema oficial de alerta (lo son IDEAM y UNGRD). humaid **no** es un chatbot que da respuestas genéricas. humaid **no** es un producto de una sola entrega — requiere despliegue con socios en cada territorio. humaid **no** es sustituto de primeros respondientes formados, equipo de alcaldía u organizaciones comunitarias — los amplifica. humaid **no** está a la venta para oficiales de riesgo empresarial — ese es otro mercado.',
  },
  {
    topic: 'project-meta-limits',
    role: 'any',
    region: 'generic',
    question_en: 'When does humaid fail?',
    question_es: '¿Cuándo falla humaid?',
    answer_en:
      'Honest list of failure modes. (1) When no satellite passes during a fast-onset event (Mocoa-style avenidas torrenciales). (2) When labelling noise on the source schema bounds detection accuracy (currently ~0.66 — Sentinel-1 retrofit should improve this). (3) When the user\'s question doesn\'t match any Q&A pair (the system shows top-k matches; an LLM synthesis layer is on the v2 roadmap). (4) When the device hasn\'t been pre-synced before the event and there\'s no internet to sync in real time.',
    answer_es:
      'Lista honesta de modos de falla. (1) Cuando no pasa ningún satélite durante un evento súbito (avenidas torrenciales tipo Mocoa). (2) Cuando el ruido del etiquetado en el esquema fuente acota la precisión (~0,66 actual — el retrofit a Sentinel-1 debería mejorarlo). (3) Cuando la pregunta del usuario no coincide con ningún par Q&A (el sistema muestra el top-k; una capa de síntesis con LLM está en la hoja de ruta v2). (4) Cuando el dispositivo no fue pre-sincronizado antes del evento y no hay internet para sincronizar en tiempo real.',
    references: ['finetune-flood/REPORT.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-limits',
    role: 'any',
    region: 'generic',
    question_en: 'Can I rely on humaid as my only source of information during a flood?',
    question_es: '¿Puedo confiar en humaid como mi única fuente de información durante una inundación?',
    answer_en:
      'No — and please don\'t. humaid is one rail; the official rail is IDEAM (alerts) + UNGRD/CDGRD/CMGRD (operational coordination) + your alcaldía + the cluster system. Always cross-check with the institutional response chain. humaid is designed to *help* you find the right action faster — it is not designed to replace the institutional accountability that ultimately governs disaster response.',
    answer_es:
      'No — y por favor no lo hagas. humaid es un riel; el riel oficial es IDEAM (alertas) + UNGRD/CDGRD/CMGRD (coordinación operativa) + tu alcaldía + el sistema de clústeres. Siempre cruza información con la cadena institucional de respuesta. humaid está diseñado para *ayudarte* a encontrar la acción correcta más rápido — no para reemplazar la rendición de cuentas institucional que en última instancia gobierna la respuesta a desastres.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 14. TECH STACK
// ─────────────────────────────────────────────────────────────────────────

const TECH: ProjectQA[] = [
  {
    topic: 'project-meta-tech',
    role: 'any',
    region: 'generic',
    question_en: 'What is humaid built with?',
    question_es: '¿Con qué está construido humaid?',
    answer_en:
      'Backend / orchestration: Deno + TypeScript. Desktop app: Tauri (Rust shell + webview). AI runtimes: llama.cpp (satellite VLM) and Ollama (laptop text + embeddings). Models: LFM2.5-VL-450M and LFM2 (Liquid AI), Nomic embeddings. Index: DuckDB. Web: Hono + React on Deno Deploy. Map demos: Mapbox GL JS. Data: PDFs and markdown converted with `ds_to_markdown`. Everything is open and committed to the repo.',
    answer_es:
      'Backend / orquestación: Deno + TypeScript. App de escritorio: Tauri (shell Rust + webview). Runtimes de IA: llama.cpp (VLM satelital) y Ollama (texto + embeddings en portátil). Modelos: LFM2.5-VL-450M y LFM2 (Liquid AI), embeddings Nomic. Índice: DuckDB. Web: Hono + React en Deno Deploy. Mapa: Mapbox GL JS. Datos: PDFs y markdown convertidos con `ds_to_markdown`. Todo abierto y comiteado al repo.',
    references: ['docs/ARCHITECTURE.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-tech',
    role: 'any',
    region: 'generic',
    question_en: 'Is humaid open source?',
    question_es: '¿humaid es de código abierto?',
    answer_en:
      'Yes. The repo is public, the Q&A dataset is public, the trained model is on Hugging Face, and the build pipelines are reproducible. License: see the repo (typical permissive humanitarian licence — designed so other regions can deploy their own humaid for their own basin without negotiating).',
    answer_es:
      'Sí. El repo es público, el dataset de Q&A es público, el modelo entrenado está en Hugging Face, y los pipelines de build son reproducibles. Licencia: ver el repo (licencia humanitaria permisiva típica — diseñada para que otras regiones desplieguen su propio humaid para su propia cuenca sin negociar).',
  },
  {
    topic: 'project-meta-tech',
    role: 'any',
    region: 'generic',
    question_en: 'Where is the source code?',
    question_es: '¿Dónde está el código fuente?',
    answer_en:
      'Public repo. The structure: `finetune-flood/` (model pipeline, Modal H100), `simsat/` (third-party, cloned upstream), `knowledge-base/` (Q&A + retrieval), `tauri/` (desktop app brief), `website/` (public site, Hono+React on Deno Deploy), `events-map/` (Mapbox sample showcase), `research/` (corpus + synthesis), `docs/` (architecture + dev notes), `pitch/` (deck content). See `README.md` at the repo root.',
    answer_es:
      'Repo público. Estructura: `finetune-flood/` (pipeline del modelo, Modal H100), `simsat/` (terceros, clonado upstream), `knowledge-base/` (Q&A + búsqueda), `tauri/` (brief de app de escritorio), `website/` (sitio público, Hono+React en Deno Deploy), `events-map/` (showcase de mapa Mapbox), `research/` (corpus + síntesis), `docs/` (arquitectura + notas de dev), `pitch/` (contenido de deck). Ver `README.md` en la raíz.',
    references: ['README.md', 'docs/ARCHITECTURE.md'],
    ref_types: ['local', 'local'],
  },
  {
    topic: 'project-meta-tech',
    role: 'humanitarian-staff',
    region: 'generic',
    question_en: 'What hardware do I need to run humaid in the field?',
    question_es: '¿Qué hardware necesito para correr humaid en terreno?',
    answer_en:
      'Minimum: a CPU-only laptop (any reasonable spec from the past 5 years). Recommended: 16 GB RAM, 100 GB free disk, an x86-64 or ARM64 CPU. No GPU required. For a community station: Raspberry Pi 5 (or equivalent, ~USD 80) with a small SSD, solar-tolerant power, optional satcom or LoRa transceiver for alert ingest. The flood-detection model lives on the satellite, not on the laptop — so the laptop\'s job is only retrieval + small text generation.',
    answer_es:
      'Mínimo: portátil solo-CPU (cualquier spec razonable de los últimos 5 años). Recomendado: 16 GB RAM, 100 GB de disco libre, CPU x86-64 o ARM64. Sin GPU. Para estación comunitaria: Raspberry Pi 5 (o equivalente, ~USD 80) con un SSD pequeño, alimentación tolerante a solar, transceptor satcom o LoRa opcional para ingesta de alertas. El modelo de detección de inundación vive en el satélite, no en el portátil — así que el trabajo del portátil es solo búsqueda + generación de texto pequeña.',
    references: ['docs/ARCHITECTURE.md'],
    ref_types: ['local'],
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 15. DEMOS / VISIBLE PIECES
// ─────────────────────────────────────────────────────────────────────────

const DEMOS: ProjectQA[] = [
  {
    topic: 'project-meta-demo',
    role: 'any',
    region: 'generic',
    question_en: 'How can I try humaid right now?',
    question_es: '¿Cómo puedo probar humaid ahora mismo?',
    answer_en:
      'Two demos live on humaid.app today. (1) **Knowledge-base demo** — type a question (EN or ES) at humaid.app/app and the system runs Nomic embedding + DuckDB cosine search over the 471 Q&A pairs. (2) **Flood-detection demo** — upload a Sentinel-2 RGB+SWIR baseline+current pair and the fine-tuned LFM2-VL emits the 7-key JSON alert. Both run server-side on Deno Deploy as a stand-in for the eventual on-orbit / on-laptop deployment.',
    answer_es:
      'Dos demos vivos en humaid.app hoy. (1) **Demo de base de conocimiento** — escribe una pregunta (EN o ES) en humaid.app/app y el sistema corre embedding Nomic + búsqueda coseno DuckDB sobre los 471 pares Q&A. (2) **Demo de detección de inundación** — sube un par baseline+actual de Sentinel-2 RGB+SWIR y el LFM2-VL afinado emite el JSON de 7 llaves. Ambos corren en Deno Deploy como sustituto del despliegue eventual en órbita / en portátil.',
    references: ['website/README.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-demo',
    role: 'any',
    region: 'generic',
    question_en: 'What is the events map?',
    question_es: '¿Qué es el mapa de eventos?',
    answer_en:
      'A static Mapbox viewer (`events-map/`) that renders the 14 anchor municipalities as Point features with the chronological list of documented flood events at each. Filterable by region (La Mojana / Putumayo), event, and year. It\'s a sample showcase that the humaid website embeds; the same database (CSV + GeoJSON) is what the local app\'s "past incidents at this location" view will consume.',
    answer_es:
      'Un visor Mapbox estático (`events-map/`) que renderiza los 14 municipios ancla como Points, con la lista cronológica de eventos documentados de inundación en cada uno. Filtrable por región (La Mojana / Putumayo), evento y año. Es un showcase muestral que el sitio embebe; la misma base de datos (CSV + GeoJSON) es lo que la vista "incidentes pasados en este lugar" de la app local consumirá.',
    references: ['events-map/README.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-demo',
    role: 'any',
    region: 'generic',
    question_en: 'Where can I see the architecture diagram?',
    question_es: '¿Dónde veo el diagrama de arquitectura?',
    answer_en:
      'Repo: `docs/ARCHITECTURE.md`. It walks through the two AI systems (satellite VLM + laptop KB), the community station, the desktop app, the cross-cutting concerns (languages, disability, trust, privacy, update cadence), and the current status of each component. The pitch deck (`pitch/`) has a visual version. The website landing page has a condensed version too.',
    answer_es:
      'Repo: `docs/ARCHITECTURE.md`. Recorre los dos sistemas de IA (VLM satelital + base de conocimiento en portátil), la estación comunitaria, la app de escritorio, los temas transversales (idiomas, discapacidad, confianza, privacidad, cadencia de actualización) y el estado actual de cada componente. El deck (`pitch/`) tiene la versión visual. La landing del sitio también tiene una versión condensada.',
    references: ['docs/ARCHITECTURE.md'],
    ref_types: ['local'],
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 16. STATUS
// ─────────────────────────────────────────────────────────────────────────

const STATUS: ProjectQA[] = [
  {
    topic: 'project-meta-status',
    role: 'any',
    region: 'generic',
    question_en: 'What is the current project status?',
    question_es: '¿Cuál es el estado actual del proyecto?',
    answer_en:
      'Built and committed: the research corpus (17 PDFs, synthesis notes), the 471-pair knowledge base + DuckDB index, the full satellite-fine-tuning pipeline (model published to Hugging Face), the events-map sample showcase, the public-website demos. Paused: the Sentinel-2 fine-tune (waiting on a Sentinel-1 SAR retrofit). Not yet built: community-station hardware, the desktop app, the alert-polling endpoints, indigenous-language overlays.',
    answer_es:
      'Construido y comiteado: el corpus de investigación (17 PDFs, notas de síntesis), la base de conocimiento de 471 pares + índice DuckDB, el pipeline completo de fine-tune satelital (modelo publicado en Hugging Face), el showcase del mapa de eventos, los demos del sitio público. Pausado: el fine-tune Sentinel-2 (esperando retrofit Sentinel-1 SAR). No construido aún: hardware de estación comunitaria, app de escritorio, endpoints de polling de alertas, capas de idiomas indígenas.',
    references: ['pitch/traction.md', 'docs/ARCHITECTURE.md'],
    ref_types: ['local', 'local'],
  },
  {
    topic: 'project-meta-status',
    role: 'any',
    region: 'generic',
    question_en: 'Is humaid in production?',
    question_es: '¿humaid está en producción?',
    answer_en:
      'No — pre-pilot. The components are individually working (knowledge base, retrieval, fine-tuned flood model, website demos, events map) but no end-to-end community deployment exists yet. Year-1 plan deploys to 14 anchor municipalities once funding closes. Pilot-pilot-production: the cycle in 2026-2027.',
    answer_es:
      'No — pre-piloto. Los componentes funcionan individualmente (base de conocimiento, búsqueda, modelo de inundación afinado, demos del sitio, mapa de eventos) pero aún no existe un despliegue comunitario de extremo a extremo. El plan año 1 despliega a 14 municipios ancla cuando cierre la financiación. Piloto-piloto-producción: el ciclo en 2026-2027.',
    references: ['pitch/ask.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-status',
    role: 'any',
    region: 'generic',
    question_en: 'Has humaid alerted anyone in a real flood?',
    question_es: '¿humaid ha alertado a alguien en una inundación real?',
    answer_en:
      'Not yet — we are pre-pilot. The first documented "alert-to-action" case study is a Year 1 milestone. Until that exists, every claim about humaid\'s impact is forward-looking; we use historical events (Cara de Gato 2021/2024/2025, Mocoa 2017, Putumayo 2025) to validate the design but not to claim historical impact.',
    answer_es:
      'Aún no — estamos pre-piloto. El primer caso documentado de "alerta a acción" es un hito del año 1. Hasta que exista, toda afirmación sobre el impacto de humaid es prospectiva; usamos eventos históricos (Cara de Gato 2021/2024/2025, Mocoa 2017, Putumayo 2025) para validar el diseño, no para reclamar impacto histórico.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 17. VALUE PROPOSITION — per role
// ─────────────────────────────────────────────────────────────────────────

const VALUE_PROP: ProjectQA[] = [
  {
    topic: 'project-meta-value',
    role: 'local-community',
    region: 'generic',
    question_en: 'What does humaid do for me as a community member?',
    question_es: '¿Qué hace humaid por mí como miembro de la comunidad?',
    answer_en:
      'When the river rises or the dike breaks, humaid gives you the same answers a trained responder would, in plain language, on your phone or community-station screen, without internet: where to go, what to take, who to call, how to register for *Asistencia Humanitaria de Emergencia* once it\'s safe. The answers are tagged for you specifically — not the same generic checklist a humanitarian officer would see.',
    answer_es:
      'Cuando el río sube o el dique se rompe, humaid te da las mismas respuestas que daría un socorrista entrenado, en lenguaje claro, en tu teléfono o pantalla de la estación comunitaria, sin internet: a dónde ir, qué llevar, a quién llamar, cómo registrarte para Asistencia Humanitaria de Emergencia una vez sea seguro. Las respuestas están etiquetadas para ti específicamente — no el mismo checklist genérico que vería un oficial humanitario.',
  },
  {
    topic: 'project-meta-value',
    role: 'local-authority',
    region: 'generic',
    question_en: 'What does humaid do for me as a municipal authority?',
    question_es: '¿Qué hace humaid por mí como autoridad municipal?',
    answer_en:
      'humaid puts the legal and operational checklist for declaring *Calamidad Pública* (Ley 1523/2012), activating CMGRD, running EDAN, and coordinating with CDGRD/UNGRD into the hands of any *secretaría de gobierno* officer in seconds. Plus role-tagged Q&A for *cluster*-aligned response and the contact list for cluster focal points. It compresses the institutional learning curve from weeks to minutes.',
    answer_es:
      'humaid pone el checklist legal y operativo para declarar Calamidad Pública (Ley 1523/2012), activar CMGRD, correr EDAN y coordinar con CDGRD/UNGRD en manos de cualquier funcionario de la secretaría de gobierno en segundos. Además, Q&A etiquetado por rol para respuesta alineada a clúster y la lista de contactos de focales de clúster. Comprime la curva de aprendizaje institucional de semanas a minutos.',
  },
  {
    topic: 'project-meta-value',
    role: 'national-authorities',
    region: 'generic',
    question_en: 'What does humaid do for me as a national agency?',
    question_es: '¿Qué hace humaid por mí como agencia nacional?',
    answer_en:
      'For UNGRD, IDEAM, Fondo Adaptación, Unidad para las Víctimas: a delivery rail that takes the institutional knowledge you already produce — and that today reaches the duty officer at most — and puts it in front of the family, the JAC, the alcaldía. It does not replace your authority; it amplifies it. As a NASA Lifelines + UN Colombia partnership, it also gives Colombian agencies a reference for how AI should be governed in humanitarian work.',
    answer_es:
      'Para UNGRD, IDEAM, Fondo Adaptación, Unidad para las Víctimas: un riel de entrega que toma el conocimiento institucional que ya produces — y que hoy llega al oficial de turno como máximo — y lo pone frente a la familia, la JAC, la alcaldía. No reemplaza tu autoridad; la amplifica. Como alianza NASA Lifelines + UN Colombia, también da a las agencias colombianas una referencia sobre cómo gobernar la IA en trabajo humanitario.',
  },
  {
    topic: 'project-meta-value',
    role: 'humanitarian-staff',
    region: 'generic',
    question_en: 'What does humaid do for me as humanitarian staff?',
    question_es: '¿Qué hace humaid por mí como staff humanitario?',
    answer_en:
      'For OCHA, ELC, UN agencies: a structured, source-cited Q&A corpus aligned with HPC phases (pre / event / post), pre-positioned offline at field locations. It complements UMAIC info products and reduces the load on cluster leads who are repeatedly asked the same SOP questions during a response. Plus the satellite alert channel feeds rapid-response triggers without waiting for SitReps.',
    answer_es:
      'Para OCHA, ELC, agencias ONU: un corpus de Q&A estructurado, con citas a fuente, alineado con las fases del HPC (pre / event / post), pre-posicionado offline en sitios de terreno. Complementa los productos de información de UMAIC y reduce la carga sobre leads de clúster a quienes se les pregunta repetidamente las mismas SOPs durante una respuesta. Además, el canal de alertas satelitales alimenta disparadores de respuesta rápida sin esperar SitReps.',
  },
  {
    topic: 'project-meta-value',
    role: 'ngos',
    region: 'generic',
    question_en: 'What does humaid do for me as an NGO field implementer?',
    question_es: '¿Qué hace humaid por mí como ONG implementadora en terreno?',
    answer_en:
      'Three things. (1) An offline-first knowledge layer your field teams can rely on without depending on connectivity. (2) A bilingual, role-tagged Q&A corpus that you can extend with your own organisational SOPs and have indexed in days. (3) A community-station + local-app deployment template that fits inside your existing donor agreements (CERF, ECHO, USAID-BHA, SIDA) without re-negotiating compliance — privacy and data-governance posture is documented.',
    answer_es:
      'Tres cosas. (1) Una capa de conocimiento offline-first en la que tus equipos de terreno pueden confiar sin depender de conectividad. (2) Un corpus de Q&A bilingüe etiquetado por rol que puedes extender con las SOPs de tu organización e indexarlas en días. (3) Una plantilla de despliegue de estación comunitaria + app local que cabe en tus acuerdos de donante existentes (CERF, ECHO, USAID-BHA, SIDA) sin renegociar cumplimiento — la postura de privacidad y gobernanza de datos está documentada.',
  },
  {
    topic: 'project-meta-value',
    role: 'first-respondants',
    region: 'generic',
    question_en: 'What does humaid do for me as a first responder?',
    question_es: '¿Qué hace humaid por mí como primer respondiente?',
    answer_en:
      'Operational Q&A for the high-stress moments: triage protocols, swift-water rescue gates, *manejo de cadáveres* protocol, EDAN forms, comms relay procedures — all available offline on your phone or laptop, in plain Spanish, with citations. Role-tagged so you don\'t see the bureaucracy you don\'t need. Plus the satellite alert feed gives your seccional sala de crisis a few extra minutes of head start when a flood is forming.',
    answer_es:
      'Q&A operativo para los momentos de alto estrés: protocolos de triage, esclusas para rescate acuático, protocolo de manejo de cadáveres, formularios EDAN, procedimientos de relé de comunicaciones — todo disponible offline en tu teléfono o portátil, en español claro, con citas. Etiquetado por rol así no ves burocracia que no necesitas. Además, el feed de alertas satelitales da a la sala de crisis de tu seccional unos minutos extra de ventaja cuando se está formando una inundación.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 18. SCENARIO-DRIVEN — common questions framed as situations
// ─────────────────────────────────────────────────────────────────────────

const SCENARIOS: ProjectQA[] = [
  {
    topic: 'project-meta-scenario',
    role: 'local-community',
    region: 'generic',
    question_en: 'I just installed humaid — what should I do first?',
    question_es: 'Acabo de instalar humaid — ¿qué hago primero?',
    answer_en:
      'Three steps. (1) Pick your role (Familia / Líder JAC / Indigenous community / Salud / Bomberos / etc.) — this controls which content you see first. (2) Pick your region (your municipality from the list). (3) Run a sync while you have internet — the app downloads the Q&A index for offline use. After that, browse the "Pre-event" tab to read the most relevant procedures *before* anything happens. Bookmark the ones that matter to your family.',
    answer_es:
      'Tres pasos. (1) Elige tu rol (Familia / Líder JAC / Comunidad indígena / Salud / Bomberos / etc.) — esto controla qué contenido ves primero. (2) Elige tu región (tu municipio en la lista). (3) Corre una sincronización mientras tienes internet — la app descarga el índice de Q&A para uso offline. Después, explora la pestaña "Antes del evento" para leer los procedimientos más relevantes *antes* de que pase algo. Marca los que importan a tu familia.',
  },
  {
    topic: 'project-meta-scenario',
    role: 'local-community',
    region: 'la-mojana',
    question_en: 'The water is rising — what does humaid say I should do right now?',
    question_es: 'El agua está subiendo — ¿qué dice humaid que debo hacer ahora mismo?',
    answer_en:
      'Open the app, press "Alerta activa" — the *event*-phase Q&A pre-filtered for La Mojana surfaces immediately. Top items: confirm via secondary signal (river level at La Coquera, JAC alert chain), grab the family emergency bag and documents, move livestock to higher ground if there is time, head to your designated *albergue* (the app shows you the closest one), call your alcaldía emergency line. If you only have 15 minutes, ignore everything except family + documents + go.',
    answer_es:
      'Abre la app, oprime "Alerta activa" — el Q&A de fase *event* pre-filtrado para La Mojana aparece de inmediato. Lo más importante: confirma con una señal secundaria (nivel del río en La Coquera, cadena de alerta de la JAC), agarra el bolso de emergencia y los documentos, mueve el ganado a tierra alta si hay tiempo, ve al albergue asignado (la app te muestra el más cercano), llama a la línea de emergencias de tu alcaldía. Si solo tienes 15 minutos, ignora todo excepto familia + documentos + irte.',
  },
  {
    topic: 'project-meta-scenario',
    role: 'local-community',
    region: 'putumayo',
    question_en: 'There\'s a landslide warning — should I leave my house?',
    question_es: 'Hay alerta de deslizamiento — ¿debo salir de mi casa?',
    answer_en:
      'humaid surfaces the *event*-phase Q&A for Putumayo deslizamientos: visual signs (cracks in the ground, leaning trees, mud or stones falling, sudden change in stream colour), audible signs (cracking, rumbling), and the threshold rule from the Mocoa 2017 risk diagnostic. If you observe any of those, leave immediately for higher ground away from the slope — do not go back for belongings. Confirm with your CMGRD (the app shows the number) and your JAC. If unsure, the safe default in the Andean foothills is to evacuate.',
    answer_es:
      'humaid muestra el Q&A de fase *event* para deslizamientos en Putumayo: señales visuales (grietas en el piso, árboles inclinados, caída de lodo o piedras, cambio súbito de color en quebradas), señales audibles (crujidos, rumores) y la regla umbral del diagnóstico de riesgo de Mocoa 2017. Si observas cualquiera, sal inmediato a terreno alto lejos de la ladera — no vuelvas por pertenencias. Confirma con tu CMGRD (la app muestra el número) y tu JAC. Si dudas, el default seguro en el piedemonte andino es evacuar.',
    references: ['research/download-md/Mocoa-DiagnosticoRiesgos-2023.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-scenario',
    role: 'local-community',
    region: 'generic',
    question_en: 'My family was evacuated — how do I find them?',
    question_es: 'Mi familia fue evacuada — ¿cómo los encuentro?',
    answer_en:
      'Standard channel: Cruz Roja Colombiana RFL (Restablecimiento de Contactos Familiares / Restoring Family Links), available in any Cruz Roja seccional. They take registrations at *albergues* and route names. The humaid app shows the closest seccional and the Cruz Roja national line. Also check the alcaldía *censo de damnificados* — every albergue is supposed to log everyone admitted. Do NOT travel through flooded areas to look for people; let the official chain do its work and follow the radio.',
    answer_es:
      'Canal estándar: Cruz Roja Colombiana RFL (Restablecimiento de Contactos Familiares), disponible en cualquier seccional. Reciben registros en albergues y enrutan nombres. La app humaid muestra la seccional más cercana y la línea nacional de la Cruz Roja. También revisa el censo de damnificados de la alcaldía — todo albergue debe registrar a quien ingresa. NO atravieses zonas inundadas a buscar gente; deja que la cadena oficial trabaje y sigue por radio.',
  },
  {
    topic: 'project-meta-scenario',
    role: 'local-authority',
    region: 'generic',
    question_en: 'A flood alert just arrived from humaid — what is my immediate workflow?',
    question_es: 'Acaba de llegar una alerta humaid — ¿cuál es mi flujo inmediato?',
    answer_en:
      'humaid surfaces the *event*-phase, local-authority Q&A: convene CMGRD extraordinarily; activate PMU (Puesto de Mando Unificado); confirm the alert via secondary source (IDEAM BAH, river-level gauge, ground observers); push schools to suspend; pre-warn albergue managers and Cruz Roja seccional. If thresholds met, draft a *Calamidad Pública* declaration (Ley 1523, art. 57). humaid surfaces the model decree and the legal checklist.',
    answer_es:
      'humaid muestra el Q&A de fase *event* para autoridad local: convoca CMGRD extraordinario; activa PMU (Puesto de Mando Unificado); confirma la alerta con fuente secundaria (BAH del IDEAM, sensor de nivel, observadores en tierra); pide suspensión de clases; pre-avisa a coordinadores de albergues y a la seccional de Cruz Roja. Si se cumplen umbrales, redacta declaratoria de Calamidad Pública (Ley 1523, art. 57). humaid muestra el decreto modelo y el checklist legal.',
  },
  {
    topic: 'project-meta-scenario',
    role: 'humanitarian-staff',
    region: 'generic',
    question_en: 'How do I get the alert feed integrated with my SitRep cycle?',
    question_es: '¿Cómo integro el feed de alertas con mi ciclo de SitReps?',
    answer_en:
      'humaid alerts come as 7-key JSON payloads on a polling endpoint (`/api/alerts?region=&since=`). For ELC SitReps: subscribe your info-management focal to the polling endpoint, plumb the timestamps into your 3W/4W matrix, and use the `recommended_qa_ids` to attach the cluster-aligned response cards directly into the SitRep PDF. UMAIC info products already align — coordinate with the OCHA info-management focal point.',
    answer_es:
      'Las alertas humaid llegan como payloads JSON de 7 llaves en un endpoint de polling (`/api/alerts?region=&since=`). Para SitReps de ELC: suscribe a tu focal de gestión de información al endpoint, plomea los timestamps a tu matriz 3W/4W, y usa los `recommended_qa_ids` para adjuntar las tarjetas de respuesta alineadas al clúster directamente en el PDF del SitRep. Los productos de información de UMAIC ya se alinean — coordina con el focal de gestión de información de OCHA.',
    references: ['tauri/README.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-scenario',
    role: 'first-respondants',
    region: 'la-mojana',
    question_en: 'I\'m being deployed to a Cara de Gato breach — what does humaid prepare me with?',
    question_es: 'Me están desplegando a una ruptura del Cara de Gato — ¿con qué me prepara humaid?',
    answer_en:
      'humaid surfaces the swift-water + slow-onset wetland combo Q&A for Cara de Gato: equipo personal y de equipo (PFD, lifejackets, helmets, ropes, lanchas), the historical breach-spread map (water reaches Ayapel, San Benito Abad, Guaranda within X hours), evacuation logic for the *ciénaga* villages, the comms-relay protocol for radio when celulares are down, and the chain of command (CMGRD → PMU → coordinación con Cruz Roja seccional Sucre). Bookmark the Cara de Gato Q&A bundle before deployment — it works offline.',
    answer_es:
      'humaid muestra el Q&A combinado de rescate acuático + inundación lenta de humedal para Cara de Gato: equipo personal y de equipo (PFD, chalecos, cascos, cuerdas, lanchas), el mapa histórico de propagación de la ruptura (el agua llega a Ayapel, San Benito Abad, Guaranda en X horas), lógica de evacuación de las veredas en la ciénaga, protocolo de relé de comunicaciones por radio cuando los celulares se caen, y cadena de mando (CMGRD → PMU → coordinación con seccional de Cruz Roja Sucre). Marca el bundle de Cara de Gato antes del despliegue — funciona offline.',
  },
  {
    topic: 'project-meta-scenario',
    role: 'ngos',
    region: 'putumayo',
    question_en: 'My organisation is starting a Putumayo response — where does humaid fit in our setup?',
    question_es: 'Mi organización está iniciando una respuesta en Putumayo — ¿dónde encaja humaid en nuestro montaje?',
    answer_en:
      'Step 1: register with the ELC Putumayo (humaid surfaces the focal-point and meeting cadence). Step 2: get cleared on access protocols for territories with active GANE presence — coordinate with ICRC and OCHA HACI; humaid surfaces the protocol cards. Step 3: deploy a community station + local app at your operational hub; the deployment template is in the partner-NGO kit. Step 4: contribute Q&A pairs from your operational specialty (WASH, salud, protección, etc.) — they go to indigenous-co-design review and ELC validation before publication.',
    answer_es:
      'Paso 1: regístrate con el ELC Putumayo (humaid muestra los focales y la cadencia de reuniones). Paso 2: obtén autorización de protocolos de acceso para territorios con presencia activa de GANE — coordina con CICR y OCHA HACI; humaid muestra las tarjetas de protocolo. Paso 3: despliega una estación comunitaria + app local en tu hub operativo; la plantilla de despliegue está en el kit de ONGs socias. Paso 4: aporta pares Q&A desde tu especialidad operativa (WASH, salud, protección, etc.) — pasan a revisión de co-diseño indígena y validación del ELC antes de publicación.',
  },
  {
    topic: 'project-meta-scenario',
    role: 'local-community',
    region: 'generic',
    question_en: 'I lost my home — what is humaid\'s next step for me?',
    question_es: 'Perdí mi casa — ¿cuál es el siguiente paso que humaid me indica?',
    answer_en:
      'humaid surfaces the *post*-phase Q&A for damnificados. Step 1: register in the *censo de damnificados* (alcaldía). Step 2: claim *Asistencia Humanitaria de Emergencia* (AHE) from UNGRD — the 1077/2015 decree is the legal basis; humaid shows the form requirements. Step 3: apply for *Atención y Ayuda Humanitaria Inmediata* (AHI) at the alcaldía if you are a victim of armed conflict (different from natural disaster). Step 4: contact Cruz Roja or your JAC for shelter, NFI kit, food, and psychosocial support. Steps continue per the local-community / post / region matrix.',
    answer_es:
      'humaid muestra el Q&A de fase *post* para damnificados. Paso 1: regístrate en el censo de damnificados (alcaldía). Paso 2: reclama Asistencia Humanitaria de Emergencia (AHE) ante UNGRD — el decreto 1077/2015 es la base legal; humaid muestra los requisitos del formulario. Paso 3: solicita Atención y Ayuda Humanitaria Inmediata (AHI) en la alcaldía si eres víctima del conflicto armado (distinto de desastre natural). Paso 4: contacta Cruz Roja o tu JAC para alojamiento, kit NFI, alimentación y acompañamiento psicosocial. Los pasos continúan por la matriz local-community / post / región.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 19. ECOSYSTEM PARTNERS (technical / commercial)
// ─────────────────────────────────────────────────────────────────────────

const ECOSYSTEM: ProjectQA[] = [
  {
    topic: 'project-meta-ecosystem',
    role: 'any',
    region: 'generic',
    question_en: 'What is Liquid AI and why does humaid use their model?',
    question_es: '¿Qué es Liquid AI y por qué humaid usa su modelo?',
    answer_en:
      'Liquid AI is the company behind LFM2 — a family of small efficient foundation models. We use LFM2.5-VL-450M for the satellite-side flood detector and LFM2 (text) for the laptop knowledge-base assistant. They\'re open-weights, designed for edge / on-device inference, and have a published wildfire-detection cookbook example using the same architectural pattern we\'re using.',
    answer_es:
      'Liquid AI es la empresa detrás de LFM2 — una familia de modelos fundacionales pequeños y eficientes. Usamos LFM2.5-VL-450M para el detector de inundación satelital y LFM2 (texto) para el asistente de base de conocimiento en portátil. Son de pesos abiertos, diseñados para inferencia en borde / dispositivo, y tienen un ejemplo cookbook publicado de detección de incendios usando el mismo patrón arquitectónico que usamos.',
  },
  {
    topic: 'project-meta-ecosystem',
    role: 'any',
    region: 'generic',
    question_en: 'What is SimSat?',
    question_es: '¿Qué es SimSat?',
    answer_en:
      'SimSat is an open-source satellite simulator (DPhi-Space) we use during data preparation. It serves Sentinel-2 imagery on demand for any (lon, lat, timestamp) by proxying the AWS Element84 STAC catalogue. We pull historical La Mojana / Putumayo imagery from it to assemble the labelled training pairs. SimSat is a third-party project — we clone it as a Docker service; it\'s not part of the production runtime.',
    answer_es:
      'SimSat es un simulador satelital de código abierto (DPhi-Space) que usamos en la preparación de datos. Sirve imágenes Sentinel-2 a demanda para cualquier (lon, lat, timestamp) actuando como proxy del catálogo AWS Element84 STAC. Sacamos imágenes históricas de La Mojana / Putumayo de él para armar los pares de entrenamiento etiquetados. SimSat es un proyecto de terceros — lo clonamos como servicio Docker; no es parte del runtime de producción.',
    references: ['simsat/README.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-ecosystem',
    role: 'any',
    region: 'generic',
    question_en: 'What is Modal and why does humaid use it?',
    question_es: '¿Qué es Modal y por qué humaid lo usa?',
    answer_en:
      'Modal is a serverless GPU platform we use to train the flood-detection model on H100s. It\'s a development-time dependency, not a production one — once the model is trained and packaged as a GGUF, it runs on the satellite (llama.cpp) without Modal. We also use the leap-finetune library (Liquid AI\'s open-source fine-tuning library) which orchestrates Modal jobs.',
    answer_es:
      'Modal es una plataforma serverless de GPU que usamos para entrenar el modelo de detección de inundación en H100. Es una dependencia en tiempo de desarrollo, no de producción — una vez entrenado y empaquetado como GGUF, el modelo corre en el satélite (llama.cpp) sin Modal. También usamos la librería leap-finetune (librería open-source de fine-tune de Liquid AI) que orquesta los jobs de Modal.',
  },
  {
    topic: 'project-meta-ecosystem',
    role: 'any',
    region: 'generic',
    question_en: 'Does humaid use the Disasters Charter?',
    question_es: '¿humaid usa el Disasters Charter?',
    answer_en:
      'Indirectly, through the NASA Lifelines program affiliation. The Disasters Charter is the international cooperation mechanism for satellite tasking during major disasters; UNOSAT and Copernicus EMS frequently activate it. humaid sits adjacent to that ecosystem rather than inside it — we add the on-orbit-inference + offline-first-delivery layer that the Charter products themselves don\'t provide.',
    answer_es:
      'Indirectamente, a través de la afiliación al programa NASA Lifelines. El Disasters Charter es el mecanismo de cooperación internacional para tareo satelital durante desastres mayores; UNOSAT y Copernicus EMS lo activan frecuentemente. humaid está adyacente a ese ecosistema, no dentro — sumamos la capa de inferencia en órbita + entrega offline-first que los productos del Charter mismos no proveen.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 20. INDIGENOUS CO-DESIGN — deeper than the partners section
// ─────────────────────────────────────────────────────────────────────────

const INDIGENOUS: ProjectQA[] = [
  {
    topic: 'project-meta-indigenous',
    role: 'any',
    region: 'putumayo',
    question_en: 'How does humaid respect indigenous-data sovereignty?',
    question_es: '¿Cómo respeta humaid la soberanía de datos indígena?',
    answer_en:
      'Three architectural commitments. (1) Q&A pairs that reference indigenous territory or knowledge are reviewed and approved by the relevant *cabildo* before publication. (2) Sample contact data and territorial information for indigenous areas are coordinated with the *autoridad tradicional* — names, locations, traditional resource maps, sacred-site coordinates stay under community control. (3) The local app does not transmit user role / location / territorial information off-device — there is no upstream telemetry of indigenous use patterns.',
    answer_es:
      'Tres compromisos arquitectónicos. (1) Los pares Q&A que referencian territorio o conocimiento indígena son revisados y aprobados por el cabildo pertinente antes de publicación. (2) Los datos de contacto muestrales e información territorial para zonas indígenas se coordinan con la autoridad tradicional — nombres, ubicaciones, mapas tradicionales de recursos, coordenadas de sitios sagrados quedan bajo control comunitario. (3) La app local no transmite el rol / ubicación / información territorial del usuario fuera del dispositivo — no hay telemetría aguas arriba de patrones de uso indígena.',
  },
  {
    topic: 'project-meta-indigenous',
    role: 'any',
    region: 'putumayo',
    question_en: 'Can my cabildo deploy humaid on its own terms?',
    question_es: '¿Mi cabildo puede desplegar humaid en sus propios términos?',
    answer_en:
      'Yes — that\'s exactly the deployment pattern for indigenous territory. The cabildo and *autoridad tradicional* decide: which content is shared, which language is primary, who installs the community station, who has access to which Q&A pair. humaid provides the technical scaffolding; the cabildo defines the territorial deployment terms. We do not deploy in indigenous territory without explicit consent from the relevant cabildo and routing through the territorial association.',
    answer_es:
      'Sí — ese es exactamente el patrón de despliegue para territorio indígena. El cabildo y la autoridad tradicional deciden: qué contenido se comparte, qué idioma es primario, quién instala la estación comunitaria, quién accede a qué par Q&A. humaid provee el andamiaje técnico; el cabildo define los términos territoriales del despliegue. No desplegamos en territorio indígena sin consentimiento explícito del cabildo pertinente y enrutamiento por la asociación territorial.',
  },
  {
    topic: 'project-meta-indigenous',
    role: 'any',
    region: 'putumayo',
    question_en: 'How does humaid handle indigenous languages?',
    question_es: '¿Cómo maneja humaid los idiomas indígenas?',
    answer_en:
      'On the v2 roadmap. Approach: bilingual Q&A pairs (Spanish + indigenous-language) co-translated with cabildo-designated translators rather than auto-translated. Initial language overlays planned with current partners: Inga, Kamëntsá, Murui Muina, Siona, Kofán in Putumayo. The Q&A schema already supports per-row language tagging; the UI language toggle is the missing piece. Embera and Wayuunaiki on the year-3 roadmap as humaid expands geographically.',
    answer_es:
      'En la hoja de ruta v2. Enfoque: pares Q&A bilingües (español + idioma indígena) co-traducidos con traductores designados por el cabildo, no auto-traducidos. Capas iniciales planeadas con socios actuales: Inga, Kamëntsá, Murui Muina, Siona, Kofán en Putumayo. El esquema de Q&A ya soporta etiqueta de idioma por fila; la pieza faltante es el toggle de idioma en la UI. Embera y Wayuunaiki en hoja de ruta año 3 a medida que humaid se expande geográficamente.',
  },
  {
    topic: 'project-meta-indigenous',
    role: 'local-community',
    region: 'putumayo',
    question_en: 'My community is on indigenous territory — how do we get a community station?',
    question_es: 'Mi comunidad está en territorio indígena — ¿cómo conseguimos una estación comunitaria?',
    answer_en:
      'Path: through your *cabildo* and your territorial association (e.g. ACIPS, OZIP, OPIAC, or the relevant *autoridad tradicional*). They route the request to the humaid indigenous-co-design coordinator (Aurora Maniguaje, sample contact). Together you decide: where the station lives (escuela, casa de la cultura, casa del cabildo), who maintains it, what content is enabled, what language is primary, and how the station integrates with traditional governance. The decision belongs to the cabildo, not to humaid.',
    answer_es:
      'Camino: por tu cabildo y tu asociación territorial (por ejemplo ACIPS, OZIP, OPIAC, o la autoridad tradicional pertinente). Ellos enrutan la solicitud al coordinador de co-diseño indígena de humaid (Aurora Maniguaje, contacto de muestra). Juntos deciden: dónde vive la estación (escuela, casa de la cultura, casa del cabildo), quién la mantiene, qué contenido se activa, qué idioma es primario, y cómo la estación se integra con la gobernanza tradicional. La decisión es del cabildo, no de humaid.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 21. TROUBLESHOOTING / EDGE CASES
// ─────────────────────────────────────────────────────────────────────────

const TROUBLESHOOTING: ProjectQA[] = [
  {
    topic: 'project-meta-troubleshoot',
    role: 'any',
    region: 'generic',
    question_en: 'What if humaid isn\'t loading any answers?',
    question_es: '¿Qué hago si humaid no carga ninguna respuesta?',
    answer_en:
      'Most common cause: Ollama isn\'t running. Open a terminal and run `ollama serve`, or restart the Ollama app. Second cause: the Nomic embedding model isn\'t pulled — run `ollama pull nomic-embed-text` (one-time, ~270 MB). Third: the local DuckDB index is corrupted — delete `kb.duckdb` and run `deno task build` from `knowledge-base/` to rebuild. If none of those work, send a screenshot to support@humaid.app (sample).',
    answer_es:
      'Causa más común: Ollama no está corriendo. Abre una terminal y corre `ollama serve`, o reinicia la app de Ollama. Segunda causa: el modelo de embeddings Nomic no está descargado — corre `ollama pull nomic-embed-text` (una vez, ~270 MB). Tercera: el índice DuckDB local está corrupto — borra `kb.duckdb` y corre `deno task build` desde `knowledge-base/` para reconstruir. Si ninguno funciona, envía captura a support@humaid.app (muestra).',
  },
  {
    topic: 'project-meta-troubleshoot',
    role: 'any',
    region: 'generic',
    question_en: 'My answers are in the wrong language — how do I switch?',
    question_es: 'Mis respuestas están en el idioma equivocado — ¿cómo cambio?',
    answer_en:
      'Settings → Idioma / Language → Español / English. The change is local, instant, and persists across sessions. The Q&A index has both languages in every row, so switching doesn\'t require any download or sync.',
    answer_es:
      'Ajustes → Idioma / Language → Español / English. El cambio es local, instantáneo y persistente entre sesiones. El índice de Q&A tiene ambos idiomas en cada fila, así que cambiar no requiere descarga ni sincronización.',
  },
  {
    topic: 'project-meta-troubleshoot',
    role: 'any',
    region: 'generic',
    question_en: 'I changed my role — does that wipe my history?',
    question_es: 'Cambié mi rol — ¿eso borra mi historial?',
    answer_en:
      'No. Your alert history, bookmarks, and feedback drafts persist across role changes. The role only controls which Q&A pairs surface first and which "next-action" cards appear when an alert arrives. You can change your role any time from Settings.',
    answer_es:
      'No. Tu historial de alertas, marcadores y borradores de retroalimentación se mantienen al cambiar de rol. El rol solo controla qué pares de Q&A aparecen primero y qué tarjetas de "siguiente acción" aparecen cuando llega una alerta. Puedes cambiar de rol cuando quieras desde Ajustes.',
  },
  {
    topic: 'project-meta-troubleshoot',
    role: 'any',
    region: 'generic',
    question_en: 'Can multiple people share one humaid install?',
    question_es: '¿Pueden varias personas compartir una instalación de humaid?',
    answer_en:
      'Yes — for a community-station deployment that\'s the design. Each user connects from their own device to the station\'s Wi-Fi, picks their own role on first connect, and gets their own role-personalised view; the station stores nothing about them. For a desktop-app install, the simplest path is to share the laptop with a generic role profile (e.g. "Familia"); per-user profiles on a shared laptop are on the v2 roadmap.',
    answer_es:
      'Sí — para un despliegue de estación comunitaria, ese es el diseño. Cada usuario se conecta desde su propio dispositivo al Wi-Fi de la estación, escoge su propio rol en la primera conexión y obtiene su propia vista por rol; la estación no guarda nada sobre él. Para instalación de app de escritorio, lo más simple es compartir el portátil con un perfil genérico (por ejemplo "Familia"); perfiles por usuario en un portátil compartido están en hoja de ruta v2.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 22. CONTEXTUAL HUMANITARIAN-CONFLICT OVERLAP
// ─────────────────────────────────────────────────────────────────────────

const CONFLICT: ProjectQA[] = [
  {
    topic: 'project-meta-conflict',
    role: 'any',
    region: 'putumayo',
    question_en: 'Does humaid help in armed-conflict situations?',
    question_es: '¿humaid sirve en situaciones de conflicto armado?',
    answer_en:
      'humaid focuses on flood response, but armed-conflict overlay is a fact of life in Putumayo (EMC factions, Comandos de la Frontera) and to a lesser degree in La Mojana (AGC, ELN). The Q&A corpus includes role-specific cards on humanitarian access in conflict zones, ICRC coordination, OCHA HACI desk, and access protocols for indigenous territories. humaid is not a conflict-monitoring tool; it is a flood-response tool that recognises conflict as a constraint.',
    answer_es:
      'humaid se enfoca en respuesta a inundaciones, pero la superposición con conflicto armado es un hecho cotidiano en Putumayo (facciones EMC, Comandos de la Frontera) y en menor medida en La Mojana (AGC, ELN). El corpus de Q&A incluye tarjetas específicas por rol sobre acceso humanitario en zonas de conflicto, coordinación con CICR, mesa HACI de OCHA, y protocolos de acceso para territorios indígenas. humaid no es una herramienta de monitoreo de conflicto; es una herramienta de respuesta a inundación que reconoce el conflicto como restricción.',
    references: ['research/download-md/OCHA-Putumayo-Briefing-Departamental-2025.md'],
    ref_types: ['local'],
  },
  {
    topic: 'project-meta-conflict',
    role: 'humanitarian-staff',
    region: 'putumayo',
    question_en: 'How does humaid handle access constraints from non-state armed groups?',
    question_es: '¿Cómo maneja humaid las restricciones de acceso de grupos armados no estatales?',
    answer_en:
      'Two layers. (1) The content layer: Q&A pairs include role-specific protocols for principled access dialogue (ICRC three-track approach) and OCHA HACI desk coordination. (2) The deployment layer: where the security context restricts physical access, the community-station-and-LAN model still works because users can connect from inside the affected territory — the data can travel even when humanitarian staff cannot. This is one reason offline-first matters: it doesn\'t require humanitarian access to deliver knowledge.',
    answer_es:
      'Dos capas. (1) Capa de contenido: los pares Q&A incluyen protocolos específicos por rol para diálogo de acceso bajo principios (enfoque tres-track del CICR) y coordinación con mesa HACI de OCHA. (2) Capa de despliegue: donde el contexto de seguridad restringe acceso físico, el modelo de estación comunitaria + LAN sigue funcionando porque los usuarios se conectan desde dentro del territorio afectado — los datos pueden viajar aunque el staff humanitario no pueda. Esta es una razón por la que offline-first importa: no requiere acceso humanitario para entregar conocimiento.',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────

export const PROJECT_QA: ProjectQA[] = [
  ...BASICS,
  ...PARTNERS,
  ...SCOPE,
  ...CONTACTS,
  ...INSTALL,
  ...PRIVACY,
  ...ALERTS,
  ...MODELS,
  ...KB,
  ...ROADMAP,
  ...PARTNERSHIPS,
  ...COMPARISON,
  ...LIMITATIONS,
  ...TECH,
  ...DEMOS,
  ...STATUS,
  ...VALUE_PROP,
  ...SCENARIOS,
  ...ECOSYSTEM,
  ...INDIGENOUS,
  ...TROUBLESHOOTING,
  ...CONFLICT,
]
