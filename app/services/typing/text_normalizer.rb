module Typing
  class TextNormalizer
    def self.call(text)
      new(text).call
    end

    def initialize(text)
      @text = text.to_s
    end

    def call
      @text
        .unicode_normalize(:nfkc)
        .then { |value| I18n.transliterate(value) }
        .downcase
        .gsub(/[^a-z0-9\s]/, " ")
        .squeeze(" ")
        .strip
    end
  end
end
