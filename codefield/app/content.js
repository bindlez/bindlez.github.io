export const content = {
  cpp: {
    filename:'playground.cpp',starter:'#include <iostream>\n#include <string>\n\nint main() {\n    std::string greeting = "Hello, C++!";\n    std::cout << greeting << "\\n";\n}',
    exercise:{title:'Explore a string',text:'Print a greeting and its length.',starter:'#include <iostream>\n#include <string>\n\nint main() {\n    std::string greeting = "hello";\n    // Print greeting.size()\n}',hint:'Try std::cout << greeting.size();'},
    docs:[
      {name:'CppString#size',description:'Returns the number of characters in the string.',example:'std::string word = "hello";\nword.size(); // 5',insert:'#include <iostream>\n#include <string>\nint main() {\n    std::string word = "hello";\n    std::cout << word.size();\n}'},
      {name:'CppString#substr',description:'Returns a substring starting at a specified position.',example:'std::string word = "hello";\nword.substr(1, 3); // "ell"',insert:'#include <iostream>\n#include <string>\nint main() {\n    std::string word = "hello";\n    std::cout << word.substr(1, 3);\n}'},
      {name:'CppVector#push_back',description:'Adds an element to the end of a vector.',example:'std::vector<int> items{1, 2};\nitems.push_back(3);',insert:'#include <iostream>\n#include <vector>\nint main() {\n    std::vector<int> items{1, 2};\n    items.push_back(3);\n    std::cout << items.size();\n}'}
    ]
  },
  rust: {
    filename:'playground.rs', starter:'let greeting = "Hello, Rust!";\nprintln!("{}", greeting);',
    exercise:{title:'Explore a string',text:'Create a greeting and print its length.',starter:'fn main() {\n    let greeting = "hello";\n    // Print the length of greeting\n}',hint:'Try greeting.len() inside println!.'},
    docs:[
      {name:'str#len',description:'Returns the length of the string slice in bytes.',example:'let word = "hello";\nprintln!("{}", word.len()); // 5',insert:'fn main() {\n    let word = "hello";\n    println!("{}", word.len());\n}'},
      {name:'str#chars',description:'Returns an iterator over the characters of the string slice.',example:'"hi".chars()',insert:'fn main() {\n    for c in "hello".chars() { println!("{}", c); }\n}'},
      {name:'Vec#push',description:'Appends an element to the back of a vector.',example:'let mut items = vec![1, 2];\nitems.push(3);',insert:'fn main() {\n    let mut items = vec![1, 2];\n    items.push(3);\n    println!("{:?}", items);\n}'}
    ]
  },
  ruby: {
    filename: 'playground.rb', starter: 'word = "hello"\nword.chars.tally',
    exercise: {title: 'Count the characters', text: 'Turn a word into characters, then count how often each one appears.', starter: 'word = "hello"\n# Count the letters in word', hint: 'Try converting the string with chars, then look at tally.'},
    docs: [
      {name:'String#chars', description:'Returns an array containing the characters in a string.', example:'"hello".chars\n# => ["h", "e", "l", "l", "o"]', insert:'word = "hello"\nword.chars'},
      {name:'String#split', description:'Splits a string into an array using a separator.', example:'"jo hn a".split(" ")\n# => ["jo", "hn", "a"]', insert:'"jo hn a".split(" ")'},
      {name:'Array#last', description:'Returns the last element, or nil if the array is empty. Pass a count to return the last several elements.', example:'["jo", "hn", "a"].last\n# => "a"', insert:'"jo hn a".split(" ").last'},
      {name:'Array#first', description:'Returns the first element, or nil if the array is empty.', example:'["jo", "hn", "a"].first\n# => "jo"', insert:'["jo", "hn", "a"].first'},
      {name:'Array#length', description:'Returns the number of elements in the array.', example:'["jo", "hn", "a"].length\n# => 3', insert:'["jo", "hn", "a"].length'},
      {name:'Array#reverse', description:'Returns a new array with the elements in reverse order.', example:'[1, 2, 3].reverse\n# => [3, 2, 1]', insert:'[1, 2, 3].reverse'},
      {name:'Array#uniq', description:'Returns a new array with duplicate elements removed.', example:'[1, 1, 2].uniq\n# => [1, 2]', insert:'[1, 1, 2].uniq'},
      {name:'Array#join', description:'Returns a string made by joining the elements with an optional separator.', example:'["jo", "hn", "a"].join("-")\n# => "jo-hn-a"', insert:'["jo", "hn", "a"].join("-")'},
      {name:'String#upcase', description:'Returns a new string with lowercase characters converted to uppercase.', example:'"hello".upcase\n# => "HELLO"', insert:'"hello".upcase'},
      {name:'String#downcase', description:'Returns a new string with uppercase characters converted to lowercase.', example:'"HELLO".downcase\n# => "hello"', insert:'"HELLO".downcase'},
      {name:'String#strip', description:'Returns a new string with leading and trailing whitespace removed.', example:'"  hello  ".strip\n# => "hello"', insert:'"  hello  ".strip'},
      {name:'Enumerable#tally', description:'Counts the number of occurrences of each element.', example:'["a", "b", "a"].tally\n# => {"a"=>2, "b"=>1}', insert:'["a", "b", "a"].tally'},
      {name:'Array#take_while', description:'Takes elements until the block returns false or nil.', example:'[1, 2, 3, 1].take_while { |n| n < 3 }\n# => [1, 2]', insert:'[1, 2, 3, 1].take_while { |n| n < 3 }'},
      {name:'Enumerable#map', description:'Returns a new array containing the result of the block for each element.', example:'[1, 2, 3].map { |n| n * 2 }\n# => [2, 4, 6]', insert:'[1, 2, 3].map { |n| n * 2 }'}
    ]
  },
  javascript: {
    filename: 'playground.js', starter: 'const word = "hello";\n[...word].reduce((counts, letter) => {\n  counts[letter] = (counts[letter] || 0) + 1;\n  return counts;\n}, {});',
    exercise: {title: 'Double the numbers', text: 'Make a new array with every number doubled.', starter: 'const numbers = [1, 2, 3, 4];\n// Create a new array with each number doubled', hint: 'Try the map method with a function that multiplies each number by two.'},
    docs: [
      {name:'Array.map()', description:'Creates a new array by calling a function for each element.', example:'[1, 2, 3].map(n => n * 2)\n// [2, 4, 6]', insert:'[1, 2, 3].map(n => n * 2)'},
      {name:'Array.filter()', description:'Creates a new array containing elements that pass a test.', example:'[1, 2, 3, 4].filter(n => n > 2)\n// [3, 4]', insert:'[1, 2, 3, 4].filter(n => n > 2)'},
      {name:'String.split()', description:'Splits a string into an array of substrings.', example:'"hello".split("")\n// ["h", "e", "l", "l", "o"]', insert:'"hello".split("")'},
      {name:'Array.reduce()', description:'Combines array values into a single result.', example:'[1, 2, 3].reduce((sum, n) => sum + n, 0)\n// 6', insert:'[1, 2, 3].reduce((sum, n) => sum + n, 0)'}
    ]
  }
};
