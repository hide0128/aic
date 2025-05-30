
import React, { useState, useCallback } from 'react';
import { suggestMealFromAPI } from './services/geminiService';
import LoadingSpinner from './components/LoadingSpinner';
import MealDisplay from './components/MealDisplay';

// Define SVG icons as components outside the App component

// New Header Icon (Academic Cap)
const HeaderIconComponent: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.57 50.57 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
  </svg>
);

// New Suggestion Button Icon (Light Bulb)
const LightBulbIconComponent: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.355a7.5 7.5 0 0 1-4.5 0m4.5 0v.75A2.25 2.25 0 0 1 12 21h-.003c-1.176 0-2.131-.904-2.246-2.043L9.75 18.75M12 18.75v-6.75a6.01 6.01 0 0 1 1.103-3.493L13.5 7.5l.405-1.757A4.5 4.5 0 0 1 17.25 4.5h.003c.918 0 1.75.364 2.391.951L20.25 6l.405 1.757a4.5 4.5 0 0 1-3.493 5.595M12 18.75c-.621 0-1.125-.504-1.125-1.125S11.379 16.5 12 16.5s1.125.504 1.125 1.125S12.621 18.75 12 18.75Z" />
  </svg>
);


type MealTime = '朝食' | '昼食' | '夕食';
type Cuisine = '和食' | '洋食' | '中華';
type CookingTime = '指定なし' | '15分以内' | '30分以内' | '60分以内';

export interface Meal {
  name: string;
  description: string;
}

const mealtimeOptions: { value: MealTime; label: string }[] = [
  { value: '朝食', label: '朝食' },
  { value: '昼食', label: '昼食' },
  { value: '夕食', label: '夕食' },
];

const cuisineOptions: { value: Cuisine; label: string }[] = [
  { value: '和食', label: '和食' },
  { value: '洋食', label: '洋食' },
  { value: '中華', label: '中華' },
];

const suggestionCountOptions: number[] = [1, 2, 3, 4, 5];

const cookingTimeOptions: { value: CookingTime; label: string }[] = [
  { value: '指定なし', label: '指定なし' },
  { value: '15分以内', label: '15分以内' },
  { value: '30分以内', label: '30分以内' },
  { value: '60分以内', label: '60分以内' },
];

const App: React.FC = () => {
  const [mealSuggestions, setMealSuggestions] = useState<Meal[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMealtime, setSelectedMealtime] = useState<MealTime>('夕食');
  const [selectedCuisine, setSelectedCuisine] = useState<Cuisine>('和食');
  const [numberOfSuggestions, setNumberOfSuggestions] = useState<number>(1);
  const [selectedCookingTime, setSelectedCookingTime] = useState<CookingTime>('指定なし');

  const parseMealSuggestion = (text: string): Meal => {
    let name = "AIからの献立提案";
    let description = text;

    const nameRegex = /料理名：(.*?)\n/s;
    const descRegex = /説明：([\s\S]*)/s;

    const nameMatch = text.match(nameRegex);
    if (nameMatch && nameMatch[1]) {
      name = nameMatch[1].trim();
      const descMatchInput = text.substring(nameMatch[0].length).trim();
      const descMatch = descMatchInput.match(/^説明：([\s\S]*)/s) || descMatchInput.match(/([\s\S]*)/s);
      if (descMatch && descMatch[1]) {
        description = descMatch[1].trim();
      } else {
        description = descMatchInput; 
      }
    } else {
        const descOnlyMatch = text.match(descRegex);
        if (descOnlyMatch && descOnlyMatch[1]) {
            const textBeforeDesc = text.substring(0, text.indexOf("説明：")).trim();
            if(textBeforeDesc) name = textBeforeDesc;
            description = descOnlyMatch[1].trim();
        }
    }
    if (description.startsWith("説明：")) {
        description = description.substring("説明：".length).trim();
    }
    if (description.trim() === "" || description.trim() === name) {
      description = "詳しい説明はありませんでした。";
    }
    return { name, description };
  };


  const handleFetchMeal = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setMealSuggestions(null);
    try {
      let cookingTimeConstraint = '';
      if (selectedCookingTime !== '指定なし') {
        // Removed 'じっくり' specific logic as the option is removed.
        cookingTimeConstraint = `調理時間は${selectedCookingTime}を目安とした、`;
      }

      const prompt = `今日の${selectedMealtime}におすすめの、${selectedCuisine}で、${cookingTimeConstraint}美味しくて比較的簡単に作れる料理を${numberOfSuggestions}品提案してください。各提案は「料理名：<ここに料理名>\n説明：<ここに料理の説明（2〜3文程度）>」の形式で記述し、提案と提案の間は「---次の提案---」という区切り文字で明確に区切ってください。`;
      
      const rawSuggestion = await suggestMealFromAPI(prompt);
      
      const suggestionBlocks = rawSuggestion.split("---次の提案---");
      const parsedSuggestions = suggestionBlocks.map(block => parseMealSuggestion(block.trim())).filter(meal => meal.name && meal.description && meal.name !== "AIからの献立提案");

      if (parsedSuggestions.length === 0 && rawSuggestion.trim() !== "") {
        const singleParsed = parseMealSuggestion(rawSuggestion.trim());
        if (singleParsed.name !== "AIからの献立提案" || singleParsed.description !== "詳しい説明はありませんでした.") {
           setMealSuggestions([singleParsed]);
        } else {
          setError('条件に合う料理が見つかりませんでした。条件を変えてお試しください。');
        }
      } else if (parsedSuggestions.length > 0) {
        setMealSuggestions(parsedSuggestions);
      } else {
        setError('条件に合う料理が見つかりませんでした。条件を変えてお試しください。');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '料理の提案を取得できませんでした。もう一度お試しください。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMealtime, selectedCuisine, numberOfSuggestions, selectedCookingTime]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center text-gray-800 selection:bg-blue-200 selection:text-blue-800">
      <header className="mb-8">
        <div className="flex items-center justify-center mb-2">
          <HeaderIconComponent className="w-12 h-12 text-blue-500 mr-3" />
          <h1 className="text-4xl font-bold text-blue-600 tracking-tight">AI献立サポーター</h1>
        </div>
        <p className="text-lg text-gray-600">今日の晩ごはんに迷ったら、AIにおまかせ！</p>
      </header>

      <main className="w-full max-w-lg">
        {!isLoading && !mealSuggestions?.length && !error && (
          <p className="text-xl text-gray-700 mb-6 bg-white/70 p-6 rounded-lg shadow-md">
            条件を選んで、AIに今日の献立を提案してもらいましょう！
          </p>
        )}

        <fieldset className="mb-6">
          <legend className="text-lg font-semibold text-gray-700 mb-3 text-left w-full">時間帯を選ぶ:</legend>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {mealtimeOptions.map((option) => (
              <div key={option.value}>
                <input
                  type="radio"
                  id={`mealtime-${option.value}`}
                  name="mealtime"
                  value={option.value}
                  checked={selectedMealtime === option.value}
                  onChange={() => setSelectedMealtime(option.value)}
                  className="sr-only peer"
                  aria-label={option.label}
                />
                <label
                  htmlFor={`mealtime-${option.value}`}
                  className={`px-4 py-2 border border-blue-300 rounded-lg cursor-pointer transition-colors duration-150 ease-in-out
                              hover:bg-blue-100 hover:border-blue-400 hover:text-blue-700
                              peer-checked:bg-blue-500 peer-checked:text-white peer-checked:border-blue-500
                              text-sm sm:text-base font-medium`}
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-6">
          <legend className="text-lg font-semibold text-gray-700 mb-3 text-left w-full">料理のジャンルを選ぶ:</legend>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {cuisineOptions.map((option) => (
              <div key={option.value}>
                <input
                  type="radio"
                  id={`cuisine-${option.value}`}
                  name="cuisine"
                  value={option.value}
                  checked={selectedCuisine === option.value}
                  onChange={() => setSelectedCuisine(option.value)}
                  className="sr-only peer"
                  aria-label={option.label}
                />
                <label
                  htmlFor={`cuisine-${option.value}`}
                  className={`px-4 py-2 border border-blue-300 rounded-lg cursor-pointer transition-colors duration-150 ease-in-out
                              hover:bg-blue-100 hover:border-blue-400 hover:text-blue-700
                              peer-checked:bg-blue-500 peer-checked:text-white peer-checked:border-blue-500
                              text-sm sm:text-base font-medium`}
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </fieldset>
        
        <fieldset className="mb-6">
          <legend className="text-lg font-semibold text-gray-700 mb-3 text-left w-full">提案数を選ぶ:</legend>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {suggestionCountOptions.map((count) => (
              <div key={count}>
                <input
                  type="radio"
                  id={`suggestions-${count}`}
                  name="numberOfSuggestions"
                  value={count}
                  checked={numberOfSuggestions === count}
                  onChange={() => setNumberOfSuggestions(count)}
                  className="sr-only peer"
                  aria-label={`${count}品`}
                />
                <label
                  htmlFor={`suggestions-${count}`}
                  className={`px-4 py-2 border border-blue-300 rounded-lg cursor-pointer transition-colors duration-150 ease-in-out
                              hover:bg-blue-100 hover:border-blue-400 hover:text-blue-700
                              peer-checked:bg-blue-500 peer-checked:text-white peer-checked:border-blue-500
                              text-sm sm:text-base font-medium`}
                >
                  {count}品
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-8"> {/* Increased bottom margin for spacing before button */}
          <legend className="text-lg font-semibold text-gray-700 mb-3 text-left w-full">調理時間の目安:</legend>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {cookingTimeOptions.map((option) => (
              <div key={option.value}>
                <input
                  type="radio"
                  id={`cookingTime-${option.value}`}
                  name="cookingTime"
                  value={option.value}
                  checked={selectedCookingTime === option.value}
                  onChange={() => setSelectedCookingTime(option.value)}
                  className="sr-only peer"
                  aria-label={option.label}
                />
                <label
                  htmlFor={`cookingTime-${option.value}`}
                  className={`px-4 py-2 border border-blue-300 rounded-lg cursor-pointer transition-colors duration-150 ease-in-out
                              hover:bg-blue-100 hover:border-blue-400 hover:text-blue-700
                              peer-checked:bg-blue-500 peer-checked:text-white peer-checked:border-blue-500
                              text-sm sm:text-base font-medium`}
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <button
          onClick={handleFetchMeal}
          disabled={isLoading}
          className="flex items-center justify-center w-full max-w-xs mx-auto bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform transition-all duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
          aria-live="polite"
        >
          <LightBulbIconComponent className="w-5 h-5 mr-2" />
          {isLoading ? '考え中...' : '献立を提案してもらう'}
        </button>

        {isLoading && <LoadingSpinner />}
        
        {error && (
          <div className="mt-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow" role="alert">
            <p className="font-bold">エラーが発生しました</p>
            <p>{error}</p>
          </div>
        )}

        {mealSuggestions && mealSuggestions.length > 0 && !isLoading && !error && (
          <div className="mt-8 space-y-6">
            {mealSuggestions.map((meal, index) => (
              <MealDisplay key={`${meal.name}-${index}`} meal={meal} />
            ))}
          </div>
        )}
      </main>

      <footer className="mt-12 text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} AI献立サポーター. Powered by Gemini API.</p>
      </footer>
    </div>
  );
};

export default App;
