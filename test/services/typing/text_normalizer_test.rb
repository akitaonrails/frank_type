require "test_helper"

module Typing
  class TextNormalizerTest < ActiveSupport::TestCase
    test "normalizes prose into lowercase typing text" do
      assert_equal(
        "cafe au lait 42 times",
        TextNormalizer.call("Café au lait — 42 times!", locale: :en)
      )
    end

    test "collapses repeated whitespace and punctuation" do
      assert_equal(
        "hello world again",
        TextNormalizer.call(" Hello,   world... again? ", locale: :en)
      )
    end

    test "preserves brazilian portuguese accents" do
      assert_equal(
        "coração ação café",
        TextNormalizer.call("Coração, ação — CAFÉ!", locale: :"pt-BR")
      )
    end

    test "normalizes brazilian portuguese whitespace" do
      assert_equal(
        "coração ação café",
        TextNormalizer.call("Coração\n\tação\u00A0café", locale: :"pt-BR")
      )
    end
  end
end
