// Keep includes and using declarations at file scope for short C++ snippets.
export function cppProgram(source) {
 if (/\bmain\s*\(/.test(source)) return {code:source,wrapped:false};
 const outer=[], body=[];
 for (const line of source.split('\n')) (/^\s*(?:#|using\s+namespace\b)/.test(line)?outer:body).push(line);
 return {wrapped:true,code:[...outer,'#include <iostream>','#include <string>','#include <vector>','int main() {',...body,'}'].join('\n')};
}
