class PagesController < ApplicationController
  def home
    @excerpts = Typing::ExcerptCatalog.all
  end

  def profile
  end

  def sources
    @excerpts = Typing::ExcerptCatalog.all
  end
end
