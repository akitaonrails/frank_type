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

    test "preserves Brazilian Portuguese accents under the pt-BR locale" do
      assert_equal(
        "coração açúcar não",
        TextNormalizer.call("Coração — açúcar, NÃO!", locale: "pt-BR")
      )
    end

    test "default locale still strips accents to ascii" do
      assert_equal "cafe", TextNormalizer.call("Café")
    end

    test "pt-BR output is NFC and keeps the accented word intact" do
      result = TextNormalizer.call("Coração", locale: "pt-BR")

      assert_equal result, result.unicode_normalize(:nfc)
      assert_includes result, "coração"
    end
  end
end
