import type { Category, Season } from "./types";

/** Seasonal suggestions follow the calendar, so December gets holiday
 * lights instead of pumpkin patches. */
export const SEASONAL_SUGGESTIONS: Record<Season, string[]> = {
  Spring: [
    "Picnic among the spring flowers",
    "Start a little herb garden together",
    "Spring farmers market wander",
    "Bike ride on a greenway",
    "Wildflower walk at golden hour",
    "Brunch on a sunny patio",
  ],
  Summer: [
    "Beach or lake day",
    "Outdoor concert or movie night",
    "Berry picking",
    "Sunset picnic",
    "Kayak or paddleboard outing",
    "Ice cream crawl around town",
  ],
  Fall: [
    "See the fall leaves on a hike",
    "Visit a pumpkin patch or corn maze",
    "Stargazing with hot cider",
    "Farmers market morning",
    "Scenic drive just for the foliage",
    "Bake something cozy together",
  ],
  Winter: [
    "See the holiday lights",
    "Ice skating date",
    "Cozy movie marathon with cocoa",
    "Bake holiday cookies together",
    "Crisp winter hike, then soup",
    "Visit a Christmas market or festival",
  ],
};

export const SUGGESTIONS: Record<Exclude<Category, "seasonal">, string[]> = {
  longterm: [
    "Take a big trip somewhere new",
    "Learn a new skill side by side",
    "Plant a little garden",
    "Volunteer together",
    "Start a tradition that's just yours",
    "Save up for something for your home",
  ],
  date: [
    "Picnic at golden hour",
    "Bookstore wander, then coffee",
    "Sunset walk and ice cream",
    "Stardew Valley co-op night",
    "Museum afternoon",
    "Live music night",
  ],
  dinner: [
    "Taco night with homemade salsa",
    "Breakfast for dinner",
    "Soup and grilled cheese night",
    "Pasta from scratch",
    "Roll-your-own sushi night",
    "Pizza night with weird toppings",
  ],
  recipe: [
    "Sheet-pan chicken with sweet potatoes and broccoli",
    "Steak fajitas with peppers and onions",
    "One-pot beef chili",
    "Garlic butter pasta",
    "A dessert with whatever fruit is in season",
  ],
  craft: [
    "Paint each other's portraits",
    "Make a photo collage of everyone",
    "Build a terrarium",
    "Tie-dye shirts",
    "Make ornaments for the holidays",
    "A scrapbook page for a favorite day",
  ],
  places: [
    "That new ramen place downtown",
    "A rooftop with a view for sunset drinks",
    "Cozy café for a slow Saturday morning",
    "Food hall crawl — a little from every stall",
    "Bakery run for pastries and coffee",
    "A neighborhood spot neither of you has tried",
  ],
};

export const CATEGORY_META: Record<
  Category,
  { label: string; emoji: string; blurb: string; color: string; soft: string }
> = {
  seasonal: {
    label: "Seasonal Bucket List",
    emoji: "🍂",
    blurb: "Little things to savor before the season turns.",
    color: "var(--accent)",
    soft: "var(--accent-soft)",
  },
  longterm: {
    label: "Long-Term Bucket List",
    emoji: "🌙",
    blurb: "The big dreams you're saving up for, together.",
    color: "var(--plum)",
    soft: "var(--plum-soft)",
  },
  date: {
    label: "Date Ideas",
    emoji: "💌",
    blurb: "For the next time one of you asks, “what should we do?”",
    color: "var(--rose)",
    soft: "var(--rose-soft)",
  },
  dinner: {
    label: "Dinner Ideas",
    emoji: "🍽️",
    blurb: "Tonight's answer, ready before anyone gets hangry.",
    color: "var(--gold)",
    soft: "var(--gold-soft)",
  },
  recipe: {
    label: "Recipe Ideas",
    emoji: "🥘",
    blurb: "Dishes to try together, and the hits worth repeating.",
    color: "var(--sage)",
    soft: "var(--sage-soft)",
  },
  craft: {
    label: "Craft Ideas",
    emoji: "🎨",
    blurb: "Projects for a cozy afternoon at the kitchen table.",
    color: "var(--sky)",
    soft: "var(--sky-soft)",
  },
  places: {
    label: "Places to Try",
    emoji: "📍",
    blurb: "Restaurants, cafés, and spots around town you want to try together.",
    color: "var(--olive)",
    soft: "var(--olive-soft)",
  },
};
