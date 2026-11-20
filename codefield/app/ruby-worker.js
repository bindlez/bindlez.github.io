// A dedicated VM per session. The runtime is loaded only when Ruby is selected.
import { DefaultRubyVM } from 'https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi@2.10.1/dist/browser/+esm';
let vm;
async function boot() {
  const response = await fetch('https://cdn.jsdelivr.net/npm/@ruby/4.0-wasm-wasi@2.10.1/dist/ruby+stdlib.wasm');
  if (!response.ok) throw new Error(`Ruby runtime download failed (${response.status})`);
  const binary = await response.arrayBuffer();
  ({ vm } = await DefaultRubyVM(await WebAssembly.compile(binary)));
  vm.eval(`require 'js'
require 'json'
require 'stringio'
$codefield_binding = TOPLEVEL_BINDING

def __codefield_type_methods(type)
  klass = { 'String'=>String, 'Array'=>Array, 'Hash'=>Hash, 'Enumerator'=>Enumerator, 'Integer'=>Integer, 'Float'=>Float }[type]
  return [].to_json unless klass
  methods = klass.public_instance_methods
  owners = methods.to_h { |name| [name.to_s, klass.instance_method(name).owner.name] }
  { methods: methods.map(&:to_s).sort, owners: owners, receiver_type: klass.to_s }.to_json
end

def __codefield_complete(receiver, chain_json)
  chain = JSON.parse(chain_json)
  value = nil
  klass = case receiver
  when /\\A["']/ then String
  when /\\A\\[/ then Array
  else
    if receiver.match?(/\\A[A-Z][A-Za-z0-9_]*\\z/)
      return [].to_json unless Object.const_defined?(receiver, false) && !Object.autoload?(receiver)
      value = Object.const_get(receiver, false)
    else
      name = receiver.to_sym
      return [].to_json unless $codefield_binding.local_variable_defined?(name)
      value = $codefield_binding.local_variable_get(name)
    end
    Object.instance_method(:class).bind_call(value)
  end
  # Infer return classes for a small set of core methods. Never execute the chain.
  transitions = {
    String => { 'chars'=>Array, 'bytes'=>Array, 'lines'=>Array, 'codepoints'=>Array, 'split'=>Array,
      'upcase'=>String, 'downcase'=>String, 'capitalize'=>String, 'strip'=>String,
      'lstrip'=>String, 'rstrip'=>String, 'reverse'=>String, 'chomp'=>String,
      'chop'=>String, 'to_s'=>String },
    Array => { 'tally'=>Hash, 'reverse'=>Array, 'compact'=>Array, 'flatten'=>Array,
      'uniq'=>Array, 'sort'=>Array, 'shuffle'=>Array, 'to_a'=>Array, 'to_s'=>String },
    Hash => { 'keys'=>Array, 'values'=>Array, 'to_a'=>Array, 'to_s'=>String,
      'invert'=>Hash, 'compact'=>Hash }
  }
  chain.each do |method|
    klass = transitions.fetch(klass, {})[method]
    return [].to_json unless klass
  end
  if chain.empty? && value
    return { methods: Object.instance_method(:public_methods).bind_call(value).map(&:to_s).sort, receiver_type: klass.to_s }.to_json
  end
  { methods: klass.public_instance_methods.map(&:to_s).sort, receiver_type: klass.to_s }.to_json
rescue StandardError
  [].to_json
end

def __codefield_run(source)
  previous_stdout, previous_stderr = $stdout, $stderr
  output, errors = StringIO.new, StringIO.new
  $stdout, $stderr = output, errors
  begin
    value = eval(source, $codefield_binding, '(playground)')
    { ok: true, value: value.inspect, type: value.class.to_s, output: output.string, stderr: errors.string,
      methods: value.methods.map(&:to_s).sort.take(200) }.to_json
  rescue Exception => error
    { ok: false, error: "#{error.class}: #{error.message}", output: output.string, stderr: errors.string }.to_json
  ensure
    $stdout, $stderr = previous_stdout, previous_stderr
  end
end`);
  self.postMessage({type:'ready'});
}
self.onmessage = async event => {
  try {
    if (event.data.type === 'init') { await boot(); return; }
    if (event.data.type === 'complete') {
      self.__codefieldReceiver = event.data.receiver;
      self.__codefieldChain = JSON.stringify(event.data.chain || []);
      self.__codefieldStaticType = event.data.staticType || '';
      const result = vm.eval(event.data.staticType ? '__codefield_type_methods(JS.global[:__codefieldStaticType].to_s)' : '__codefield_complete(JS.global[:__codefieldReceiver].to_s, JS.global[:__codefieldChain].to_s)').toString();
      const data = JSON.parse(result);
      self.postMessage({type:'completion', id:event.data.id, methods:Array.isArray(data) ? data : data.methods, owners:data.owners || {}, receiverType:data.receiver_type || null});
      return;
    }
    if (event.data.type === 'run') {
      self.__codefieldSource = event.data.code;
      const result = vm.eval('__codefield_run(JS.global[:__codefieldSource].to_s)').toString();
      self.postMessage({type:'result', result:JSON.parse(result)});
    }
  } catch (error) { self.postMessage({type:'failure', error:String(error?.message || error)}); }
};
