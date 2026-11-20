// Short original guides. The linked official reference remains the authority.
const guides={
  ruby:{
    chars:{description:'Turns a string into an array of its characters. The original string is unchanged. With a block, Ruby yields each character instead of returning the array.',example:'"hello".chars\n# => ["h", "e", "l", "l", "o"]\n\n"hi".chars.tally\n# => {"h"=>1, "i"=>1}'},
    chomp:{description:'Returns a copy of the string with its trailing record separator removed. With no argument, it removes one trailing newline sequence; it does not change the original string.',example:'"hello\\n".chomp\n# => "hello"\n\n"hello!".chomp("!")\n# => "hello"'},
    'chomp!':{description:'Removes the trailing record separator from the receiver itself. It returns the modified string, or nil when no change was needed.',example:'word = "hello\\n"\nword.chomp! # => "hello"\nword        # => "hello"'},
    chop:{description:'Returns a copy with its final character removed. A trailing carriage-return and newline pair is treated as a single line ending.',example:'"hello".chop\n# => "hell"\n\n"hello\\r\\n".chop\n# => "hello"'},
    'chop!':{description:'Removes the final character from the receiver in place. Returns the modified string, or nil if the string was empty.',example:'word = "hello"\nword.chop! # => "hell"\nword       # => "hell"'},
    chr:{description:'Returns a new string containing the first character of the receiver. The original string remains unchanged.',example:'"hello".chr\n# => "h"'},
    split:{description:'Divides a string into an array of pieces using a separator or pattern. The receiver is not modified. When no separator is supplied, Ruby splits on whitespace.',example:'"red blue red".split(" ")\n# => ["red", "blue", "red"]\n\n"a,b".split(",")\n# => ["a", "b"]'},
    tally:{description:'Counts how often each element appears in an enumerable and returns a hash mapping each distinct element to its count. It can follow methods such as chars or split that produce arrays.',example:'["a", "b", "a"].tally\n# => {"a"=>2, "b"=>1}\n\n"hello".chars.tally\n# => {"h"=>1, "e"=>1, "l"=>2, "o"=>1}'},
    first:{description:'Returns the first element, or nil for an empty array. Pass a count to get an array of up to that many elements.',example:'["a", "b", "c"].first    # => "a"\n["a", "b", "c"].first(2) # => ["a", "b"]'},
    length:{description:'Returns the size of the receiver. For an Array or Hash it counts entries; for a String it counts characters according to the string encoding.',example:'[1, 2, 3].length # => 3\n"hello".length   # => 5'},
    reverse:{description:'Returns a new array or string with the order reversed, leaving the original unchanged. The bang form modifies the receiver.',example:'[1, 2, 3].reverse # => [3, 2, 1]\n"abc".reverse     # => "cba"'},
    uniq:{description:'Returns a new array with duplicate elements removed, keeping the first occurrence of each. A block can compute the comparison key.',example:'[1, 2, 1, 3].uniq # => [1, 2, 3]'},
    join:{description:'Returns one string formed by joining an array’s elements. An optional separator is inserted between elements.',example:'["red", "blue"].join(" / ")\n# => "red / blue"'},
    select:{description:'Calls the block for each element and retains the entries for which the block is truthy. It returns a new collection.',example:'[1, 2, 3, 4].select { |n| n.even? }\n# => [2, 4]'},
    each:{description:'Visits each element and calls the block with it. Unlike map, its return value is usually the original receiver; without a block it returns an Enumerator.',example:'[1, 2, 3].each { |n| puts n }\n# prints 1, 2 and 3 on separate lines'},
    each_cons:{description:'Visits consecutive overlapping groups of the requested size. Without a block it returns an Enumerator, which can be chained with methods such as map.',example:'["h", "e", "l", "l", "o"].each_cons(2).to_a\n# => [["h", "e"], ["e", "l"], ["l", "l"], ["l", "o"]]\n\n[1, 2, 3].each_cons(2).map { |a, b| a + b }\n# => [3, 5]'},
    'empty?':{description:'Returns true if the collection or string contains no elements or characters; otherwise returns false.',example:'"".empty? # => true\n[1].empty? # => false'},
    'include?':{description:'Tests whether the receiver contains the given value. For strings it searches for a substring; for arrays it checks for an element.',example:'"hello".include?("ell") # => true\n[1, 2].include?(3)       # => false'},
    downcase:{description:'Returns a new lowercase string, leaving the original unchanged. The bang form modifies the receiver and can return nil when no change occurs.',example:'"Hello".downcase # => "hello"'},
    strip:{description:'Returns a new string with leading and trailing whitespace removed. It does not remove whitespace between words or modify the original string.',example:'"  hello world  ".strip\n# => "hello world"'},
    last:{description:'Returns the final element of an array, or nil if it is empty. Supplying a count returns an array containing up to that many elements.',example:'["red", "blue"].last\n# => "blue"\n\n[1, 2, 3].last(2)\n# => [2, 3]'},
    map:{description:'Calls the block once for each element and returns a new array of the block results. The original collection is not modified by map itself.',example:'[1, 2, 3].map { |n| n * 2 }\n# => [2, 4, 6]'},
    upcase:{description:'Returns a new string with its characters converted to uppercase where possible. The original string is unchanged; upcase! is the mutating variant.',example:'word = "hello"\nword.upcase # => "HELLO"\nword        # => "hello"'}
  },
  rust:{
    len:{description:'Returns the length of this value. For a string slice, the length is measured in bytes, not necessarily characters; for a vector or slice it is the number of elements.',example:'let word = "hello";\nassert_eq!(word.len(), 5);\n\n// A character may use more than one UTF-8 byte.\nassert_eq!("é".len(), 2);'},
    chars:{description:'Produces an iterator over the Unicode scalar values in a string slice. It does not create a collection until you consume the iterator, for example with collect.',example:'let word = "hello";\nlet letters: Vec<char> = word.chars().collect();\nassert_eq!(letters, vec![\'h\', \'e\', \'l\', \'l\', \'o\']);'},
    trim:{description:'Returns a string slice with leading and trailing whitespace removed. The slice borrows from the original string; no new string allocation is required.',example:'let word = "  hello  ";\nassert_eq!(word.trim(), "hello");'},
    split:{description:'Returns an iterator over substrings separated by a pattern. Consume the iterator with collect or a loop to work with its pieces.',example:'let parts: Vec<&str> = "red blue".split(" ").collect();\nassert_eq!(parts, vec!["red", "blue"]);'},
    collect:{description:'Consumes an iterator and builds a collection from its items. Rust often needs a type annotation to know which collection to build.',example:'let chars: Vec<char> = "hi".chars().collect();\nassert_eq!(chars, vec![\'h\', \'i\']);'}
  },
  javascript:{
    map:{description:'Creates a new array by calling a function once for each assigned element. The return values become the elements of the new array.',example:'[1, 2, 3].map(n => n * 2)\n// [2, 4, 6]'},
    filter:{description:'Creates a new array containing only elements for which the callback returns a truthy value.',example:'[1, 2, 3, 4].filter(n => n > 2)\n// [3, 4]'},
    reduce:{description:'Combines array elements by repeatedly calling a callback with an accumulator. An initial value makes the starting state explicit.',example:'[1, 2, 3].reduce((sum, n) => sum + n, 0)\n// 6'},
    split:{description:'Returns an array of substrings divided by the given separator. The original string is not changed.',example:'"a,b,c".split(",")\n// ["a", "b", "c"]'}
  },
  cpp:{
    size:{description:'Returns the number of elements in the string or container. For std::string, this counts stored char units, which are not always the number of Unicode characters.',example:'std::string word = "hello";\nstd::cout << word.size(); // 5'},
    substr:{description:'Creates a new string containing a portion of the original, starting at a position with an optional length.',example:'std::string word = "hello";\nauto part = word.substr(1, 3); // "ell"'},
    push_back:{description:'Adds an element to the end of a vector or a character to a string, modifying that container.',example:'std::vector<int> values{1, 2};\nvalues.push_back(3); // [1, 2, 3]'}
  }
};
export function methodGuide(language,name,doc){
 const guide=guides[language]?.[name];
 return {description:guide?.description||doc?.description||'A detailed guide is not available for this method yet. Open the language reference for its signature, behavior, arguments, return value, and examples.',example:guide?.example||doc?.example||null};
}
