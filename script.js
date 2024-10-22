// Clé API Google pour accéder aux services Google
const LAPAN41RKUZ9P5ZTKZLFHP6ZPPQCY2IS = "AIzaSyBbiu8YC1q-nJMu5y3-P9Hr6TpBJbz6rwQ";

// Gestion du carousel d'images
const carousel = document.getElementById("carousel");
let currentIndex = 0;

// Fonction pour faire défiler le carousel
function slide() {
    currentIndex = (currentIndex + 1) % 3;
    // Applique la transition pour déplacer le carousel
    carousel.style.transform = `translateX(-${currentIndex * 100}%)`;
}

// Déclenche le défilement automatique toutes les 3 secondes
setInterval(slide, 3000);

// Récupère l'élément de messagerie et efface son historique
const messenger = document.querySelector("df-messenger");
messenger.clearStorage();

// Fonction pour extraire la conversation du chat
function getConversation() {
    // Navigation dans le DOM shadow pour récupérer les messages
    const messages = messenger.children[0].shadowRoot.children[0]
        .getElementsByTagName("df-messenger-message-list")[0]
        .shadowRoot.getElementById("message-list").children[0].children;
    let str = "";
    // Parcourt tous les messages pour les formater
    for (const msg of messages) {
        if (msg.children[0].shadowRoot !== null) {
            const messageBlock = msg.children[0].shadowRoot.children[0].children[0].shadowRoot;
            const message = messageBlock.children[messageBlock.children.length - 1];
            // Ajoute un préfixe selon l'expéditeur (agent ou utilisateur)
            const prefix = message.classList.contains("bot-message") ? "Agent: " : "Utilisateur:";
            str += "\n" + prefix + message.textContent;
        }
    }
    return str;
}

// Fonction pour générer une requête Google Places à partir de la conversation
function getGooglePlaceQuery(conversation) {
    // Définition du prompt pour l'API Gemini
    const prompt = `"""Analyze the provided conversation between a user and an agent discussing restaurant recommendations. Extract key information such as cuisine type, location, price range, and any special requirements or preferences mentioned. Based on this analysis, construct a concise and revelant Google Places query that would best match the user's needs. Examples:
- "romantic italian restaurant in Paris Eiffel Tower"
- "sushi bar in Tokyo sake tasting"
- "halal indian buffet in Toronto wheelchair accessible"
Return only the optimized search query, without any additional explanation.
<conversation>
${conversation}
</conversation>"""`;

    // Appel à l'API Gemini pour analyser la conversation
    return fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${LAPAN41RKUZ9P5ZTKZLFHP6ZPPQCY2IS}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ]
            })
        }
    )
        .then((response) => response.json())
        .then((data) => {
            // Extraction du message de la réponse de l'API
            if (
                data.candidates &&
                data.candidates[0] &&
                data.candidates[0].content &&
                data.candidates[0].content.parts
            ) {
                return data.candidates[0].content.parts[0].text;
            } else {
                throw new Error("Unexpected response structure");
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            throw error;
        });
}

// Écoute de l'événement de fin de conversation
window.addEventListener("df-response-received", (event) => {
    // Vérifie si c'est un événement de fin de session
    if (
        event.detail &&
        event.detail.raw &&
        event.detail.raw.queryResult &&
        event.detail.raw.queryResult.match &&
        event.detail.raw.queryResult.match.event === "END_SESSION"
    ) {
        const conversation = getConversation();
        messenger.clearStorage();

        // Génère une requête de recherche et trouve les restaurants correspondants
        getGooglePlaceQuery(conversation).then((query) => {
            findPlaces(query);
            chatContainer.classList.add("hidden");
        });
    } else {
        console.log("raw or match is undefined");
    }
});

// Gestion du bouton d'ouverture du chat
const button = document.getElementById("open-chat");
const chatContainer = document.getElementById("chat-container");

button.addEventListener("click", () => {
    chatContainer.classList.remove("hidden");
    chatContainer.classList.add("animate-fade-in");
    chatContainer.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Variables pour Google Maps
let map;
let service;
let infowindow;

// Initialisation de la carte Google Maps
function initMap() {
    infowindow = new google.maps.InfoWindow();
    map = new google.maps.Map(document.getElementById("map"), {});
}

// Fonction pour rechercher des restaurants
function findPlaces(query) {
    const request = {
        query: query
    };

    service = new google.maps.places.PlacesService(map);

    const container = document.getElementById("restaurantResults");
    container.innerHTML = ""; // Efface les résultats précédents

    // Recherche des restaurants via l'API Google Places
    service.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            // Pour chaque restaurant trouvé
            results.forEach((restaurant) => {
                // Vérifie si le restaurant est ouvert et est bien un restaurant
                if (restaurant.business_status === "OPERATIONAL" && restaurant.types.includes("restaurant")) {
                    // Création de la carte du restaurant
                    const card = document.createElement("div");
                    card.className =
                        "bg-white rounded-lg shadow-lg overflow-hidden transform transition duration-300 hover:scale-105";

                    // Gestion de l'image du restaurant
                    const imageSrc =
                        restaurant.photos && restaurant.photos[0]
                            ? restaurant.photos[0].getUrl({ maxWidth: 400, maxHeight: 300 })
                            : "https://via.placeholder.com/400x300?text=No+Image";

                    // Formatage du niveau de prix et du statut d'ouverture
                    const priceLevel = restaurant.price_level ? "$".repeat(restaurant.price_level) : "N/A";

                    // Construction du HTML de la carte
                    card.innerHTML = `
                        <div class="relative">
                            <img src="${imageSrc}" alt="${restaurant.name}" class="w-full h-48 object-cover">
                            <div class="absolute top-0 right-0 bg-black bg-opacity-50 text-white px-2 py-1 m-2 rounded">
                                ${priceLevel}
                            </div>
                        </div>
                        <div class="p-4">
                            <h2 class="text-xl font-bold mb-2 text-gray-800">${restaurant.name}</h2>
                            <p class="text-gray-600 mb-2 text-sm"><i class="fas fa-map-marker-alt mr-2"></i>${restaurant.formatted_address}</p>
                            <div class="flex items-center mb-2">
                                <span class="text-yellow-500 mr-1"><i class="fas fa-star"></i></span>
                                <span class="text-gray-700">${restaurant.rating} (${restaurant.user_ratings_total} reviews)</span>
                            </div>
                            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}&query_place_id=${restaurant.place_id}" 
                               target="_blank" 
                               class="inline-block bg-blue-500 text-white px-4 py-2 rounded mt-2 hover:bg-blue-600 transition duration-300">
                                <i class="fas fa-map-marked-alt mr-2"></i>View on Google Maps
                            </a>
                        </div>
                    `;

                    // Ajout de la carte au conteneur de résultats
                    container.appendChild(card);
                }
            });
        }
    });
}

// Exposition de la fonction initMap pour Google Maps
window.initMap = initMap;