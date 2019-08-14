const Twing = require("twing");
const TemplateEngine = require("./TemplateEngine");
const TemplatePath = require("../TemplatePath");

class Twig extends TemplateEngine {
  constructor(name, includesDir) {
    super(name, includesDir);

    this.setLibrary(this.config.libraryOverrides.twig);
  }

  setLibrary(env) {
    this.stringCache = new Twing.TwingLoaderArray({});

    // Make the absolute file system loader conditional in case the _includes dir does not exist
    // Twing throws an error if it can't find the directory on init
    const fileSystem = (() => {
      try {
        return new Twing.TwingLoaderFilesystem([
          super.getIncludesDir(),
          TemplatePath.getWorkingDir()
        ]);
      } catch (e) {
        return new Twing.TwingLoaderNull();
      }
    })();

    this.twigEnv =
      env ||
      new Twing.TwingEnvironment(
        new Twing.TwingLoaderChain([
          fileSystem,
          new Twing.TwingLoaderRelativeFilesystem(),
          this.stringCache
        ])
      );
    this.setEngineLib(this.twigEnv);

    this.addFilters(this.config.twigFilters);

    // TODO these all go to the same place (addTag), add warnings for overwrites
    // this.addCustomTags(this.config.nunjucksTags);
    this.addAllShortcodes(this.config.twigShortcodes);
    this.addAllPairedShortcodes(this.config.twigPairedShortcodes);
  }

  addFilters(filters) {
    for (let name in filters) {
      this.addFilter(name, filters[name]);
    }
  }

  addFilter(name, filterFn) {
    this.getEngineLib().addFilter(new Twing.TwingFilter(name, filterFn));
  }

  addCustomTags(tags) {
    // for (let name in tags) {
    //   this.addTag(name, tags[name]);
    // }
  }

  addTag(name, tagFn) {
    // let tagObj;
    // if (typeof tagFn === "function") {
    //   tagObj = tagFn(NunjucksLib, this.njkEnv);
    // } else {
    //   throw new Error(
    //     "Nunjucks.addTag expects a callback function to be passed in: addTag(name, function(nunjucksEngine) {})"
    //   );
    // }
    // this.njkEnv.addExtension(name, tagObj);
  }

  addAllShortcodes(shortcodes) {
    for (let name in shortcodes) {
      this.addShortcode(name, shortcodes[name]);
    }
  }

  addAllPairedShortcodes(shortcodes) {
    for (let name in shortcodes) {
      this.addPairedShortcode(name, shortcodes[name]);
    }
  }

  addShortcode(shortcodeName, shortcodeFn) {
    class ShortcodeTokenParser extends Twing.TwingTokenParser {
      parse(token) {
        const parser = this.parser;
        const stream = parser.getStream();

        let args = [];

        for (let i = 0; i < shortcodeFn.length; i++) {
          const next = parser.getExpressionParser().parseExpression();
          args.push(next);
        }

        stream.expect(Twing.TwingToken.BLOCK_END_TYPE);

        const value = shortcodeFn(...args);
        return new Twing.TwingNodeText(value, token.getLine(), this.getTag());
      }

      getTag() {
        return shortcodeName;
      }
    }

    this.getEngineLib().addTokenParser(new ShortcodeTokenParser());
  }

  addPairedShortcode(shortcodeName, shortcodeFn) {
    // function PairedShortcodeFunction() {
    //   this.tags = [shortcodeName];
    //   this.parse = function(parser, nodes, lexer) {
    //     var tok = parser.nextToken();
    //     var args = parser.parseSignature(true, true);
    //     parser.advanceAfterBlockEnd(tok.value);
    //     var body = parser.parseUntilBlocks("end" + shortcodeName);
    //     parser.advanceAfterBlockEnd();
    //     // return new nodes.CallExtensionAsync(this, "run", args, [body]);
    //     return new nodes.CallExtension(this, "run", args, [body]);
    //   };
    //   this.run = function(...args) {
    //     // let callback = args.pop();
    //     let body = args.pop();
    //     let [context, ...argArray] = args;
    //     let ret = new NunjucksLib.runtime.SafeString(
    //       shortcodeFn(body(), ...argArray)
    //     );
    //     // callback(null, ret);
    //     return ret;
    //   };
    // }
    // this.njkEnv.addExtension(shortcodeName, new PairedShortcodeFunction());
  }

  async compile(str, inputPath) {
    const key = inputPath || str;

    if (
      !inputPath ||
      inputPath === "twig" ||
      inputPath === "njk" ||
      inputPath === "md"
    ) {
      this.stringCache.setTemplate(key, str);
    }

    return async data => {
      return new Promise((resolve, reject) => {
        try {
          resolve(this.getEngineLib().render(key, data));
        } catch (e) {
          reject(e);
        }
      });
    };
  }
}

module.exports = Twig;
