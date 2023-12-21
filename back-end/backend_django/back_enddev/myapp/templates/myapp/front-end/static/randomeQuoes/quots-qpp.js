
const quotes = [
  "The best and most beautiful things in the world cannot be seen or even touched - they must be felt with the heart. -Helen Keller",
  "Keep your face always toward the sunshine - and shadows will fall behind you. -Walt Whitman",
  "You are never too old to set another goal or to dream a new dream. -C.S. Lewis",
  "Believe you can and you're halfway there. -Theodore Roosevelt",
  "Success is not final, failure is not fatal: it is the courage to continue that counts. -Winston Churchill",
  "If you look at what you have in life, you'll always have more. If you look at what you don't have in life, you'll never have enough. -Oprah Winfrey",
  "Happiness is not something ready made. It comes from your own actions. -Dalai Lama",
  "I can't change the direction of the wind, but I can adjust my sails to always reach my destination. -Jimmy Dean",
  "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment. -Ralph Waldo Emerson",
  "What you get by achieving your goals is not as important as what you become by achieving your goals. -Zig Ziglar",
  "I have learned over the years that when one's mind is made up, this diminishes fear. -Rosa Parks",
  "Believe in yourself and all that you are. Know that there is something inside you that is greater than any obstacle. -Christian D. Larson",
  "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle. -Steve Jobs",
  "The best way to predict your future is to create it. -Abraham Lincoln",
  "I would rather die of passion than of boredom. -Vincent van Gogh",
  "Do what you can, with what you have, where you are. -Theodore Roosevelt",
  "Don't watch the clock; do what it does. Keep going. -Sam Levenson",
  "Strive not to be a success, but rather to be of value. -Albert Einstein",
  "What lies behind us and what lies before us are tiny matters compared to what lies within us. -Ralph Waldo Emerson",
  "Life is 10% what happens to us and 90% how we react to it. -Charles R. Swindoll",
  "The only person you are destined to become is the person you decide to be. -Ralph Waldo Emerson",
  "You miss 100% of the shots you don't take. -Wayne Gretzky",
  "In the end, it's not the years in your life that count. It's the life in your years. -Abraham Lincoln",
  "Success is stumbling from failure to failure with no loss of enthusiasm. -Winston Churchill",
  "It does not matter how slowly you go as long as you do not stop. -Confucius",
  "If you want to lift yourself up, lift up someone else. -Booker T. Washington",
  "We can't help everyone, but everyone can help someone. -Ronald Reagan",
  "The greatest glory in living lies not in never falling, but in rising every time we fall. -Nelson Mandela",
  "I have not failed. I've just found 10,000 ways that won't work. -Thomas Edison",
  "Our greatest weakness lies in giving up. The most certain way to succeed is always to try just one more time. -Thomas A. Edison"
  ];
          function generateQuote() {
      const randomNumber = Math.floor(Math.random() * quotes.length);
      document.getElementById("quote").innerHTML = quotes[randomNumber];
  }
